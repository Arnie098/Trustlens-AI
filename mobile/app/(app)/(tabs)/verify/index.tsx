import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { useSession } from "@/src/features/auth/session";
import { ensureConsent, submitVerification } from "@/src/lib/verify/submit";
import { prepareImageForAnalysis } from "@/src/lib/image-prep";
import { uriToJpegBytes } from "@/src/lib/image-upload";
import { normalizeUrl } from "@/src/lib/url";
import {
  isUnescoOcrConfigured,
  recognizeTextFromImageUri,
  type OcrEngine,
  type OcrResult,
} from "@/src/lib/ocr";
import { getApiBaseUrl } from "@/src/lib/config";
import { notify } from "@/src/lib/notify";
import { db } from "@/src/lib/db";
import { Button, Card, Input, Label, Muted, Screen, SectionLabel, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";

type Tab = "url" | "text" | "image" | "scan";

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ tab?: string; prefill?: string }>();
  const { user, profile, refreshProfile } = useSession();
  const [tab, setTab] = useState<Tab>("url");
  const [consent, setConsent] = useState(Boolean(profile?.ai_consent));
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState("image.jpg");
  const [ocrHint, setOcrHint] = useState("");
  const [ocrEngine, setOcrEngine] = useState<OcrEngine | null>(null);
  const [ocrMeta, setOcrMeta] = useState<Pick<OcrResult, "action" | "confidence" | "message"> | null>(
    null,
  );

  useEffect(() => {
    if (profile?.ai_consent) setConsent(true);
  }, [profile?.ai_consent]);

  useEffect(() => {
    if (params.tab && ["url", "text", "image", "scan"].includes(String(params.tab))) {
      setTab(params.tab as Tab);
    }
    if (params.prefill) {
      if (params.tab === "text") setText(String(params.prefill));
      else if (params.tab === "url") setUrl(String(params.prefill));
      else if (/^https?:\/\//i.test(String(params.prefill))) {
        setTab("url");
        setUrl(String(params.prefill));
      } else {
        setTab("text");
        setText(String(params.prefill));
      }
    }
  }, [params.tab, params.prefill]);

  const tabs = useMemo(
    () =>
      [
        { id: "url" as const, label: "URL" },
        { id: "text" as const, label: "Text" },
        { id: "image" as const, label: "Image" },
        { id: "scan" as const, label: "Scan" },
      ] as const,
    [],
  );

  async function run(payload: Parameters<typeof submitVerification>[1]) {
    if (!user) {
      notify("Sign in required");
      return;
    }
    if (!consent) {
      notify("Consent required", "Enable AI-processing consent to continue.");
      return;
    }
    setLoading(true);
    try {
      await ensureConsent(user.id, consent);
      await refreshProfile();
      const id = await submitVerification(user.id, payload);
      router.push(`/(app)/verify/${id}`);
    } catch (e) {
      notify("Verification failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function pickImage(fromCamera: boolean) {
    try {
      // Web: permissions often not required; still request on native
      if (Platform.OS !== "web") {
        const perm = fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          notify(
            "Permission needed",
            fromCamera
              ? "Allow camera access to scan posts."
              : "Allow photo library access to import screenshots.",
          );
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.85,
            allowsEditing: false,
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.85,
            allowsEditing: false,
            mediaTypes: ["images"],
            exif: false,
          });

      if (result.canceled) {
        // User closed picker — not an error
        return;
      }
      if (!result.assets?.[0]?.uri) {
        notify("No image", "Could not read the selected image. Try another file.");
        return;
      }

      const asset = result.assets[0];
      // Show preview immediately so the UI never looks “stuck”
      setImageUri(asset.uri);
      setImageName(asset.fileName || (fromCamera ? "scan.jpg" : "upload.jpg"));
      setOcrHint("");
      setOcrMeta(null);
      setOcrEngine(null);

      const prepared = await prepareImageForAnalysis(asset.uri);
      if (prepared && prepared !== asset.uri) {
        setImageUri(prepared);
      }

      const imageForOcr = prepared || asset.uri;
      setOcrLoading(true);
      try {
        const ocr = await recognizeTextFromImageUri(imageForOcr);
        setOcrEngine(ocr.engine);
        setOcrMeta({
          action: ocr.action,
          confidence: ocr.confidence,
          message: ocr.message,
        });
        if (ocr.text) setOcrHint(ocr.text);
        else setOcrHint("");

        if (ocr.action === "retake" && !ocr.text) {
          notify(
            "Hard to read",
            ocr.message ||
              "We could not extract text. Retake with better lighting, or type the caption below.",
          );
        }
      } catch (ocrErr) {
        const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
        console.warn("[verify] OCR failed:", msg);
        setOcrEngine("none");
        setOcrMeta({
          action: "retake",
          message: `OCR failed: ${msg}. You can still type a caption and Run TrustLens.`,
        });
        notify(
          "OCR failed",
          `${msg}\n\nAPI: ${getApiBaseUrl() || "(not set)"}\nYou can still type the caption and continue.`,
        );
      } finally {
        setOcrLoading(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[verify] pickImage failed:", msg);
      notify("Could not open image", msg);
      setOcrLoading(false);
    }
  }

  async function uploadAndAnalyzeImage() {
    if (!user) {
      notify("Sign in required");
      return;
    }
    if (!imageUri) {
      notify("Image required", "Tap Gallery or Camera first.");
      return;
    }
    if (!consent) {
      notify("Consent required", "Enable AI-processing consent first.");
      return;
    }
    setLoading(true);
    try {
      await ensureConsent(user.id, consent);
      const { body, size } = await uriToJpegBytes(imageUri);
      const path = `${user.id}/${Date.now()}-${imageName.replace(/[^a-z0-9.\-_]/gi, "_")}`;
      const { error: upErr } = await db.storage.from("verification-uploads").upload(path, body, {
        contentType: "image/jpeg",
      });
      if (upErr) throw new Error(upErr.message);
      const { data: uploaded, error: upDbErr } = await db
        .from("uploaded_content")
        .insert({
          user_id: user.id,
          storage_path: path,
          mime_type: "image/jpeg",
          size_bytes: size,
        })
        .select()
        .single();
      if (upDbErr) throw new Error(upDbErr.message);

      if (ocrHint.trim().length >= 10) {
        const id = await submitVerification(user.id, {
          type: "text",
          input_text: ocrHint.trim(),
          imageName,
          uploaded_content_id: uploaded?.id,
        });
        router.push(`/(app)/verify/${id}`);
        return;
      }
      const id = await submitVerification(user.id, {
        type: "image",
        imageName,
        uploaded_content_id: uploaded?.id,
      });
      router.push(`/(app)/verify/${id}`);
    } catch (e) {
      notify("Image verify failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function pasteClipboard() {
    const t = (await Clipboard.getStringAsync()).trim();
    if (!t) {
      notify("Clipboard empty");
      return;
    }
    if (/^https?:\/\//i.test(t)) {
      setTab("url");
      setUrl(t);
    } else {
      setTab("text");
      setText(t);
    }
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionLabel>Analyze</SectionLabel>
        <Title>Verify content</Title>
        <Muted>URL, text, image, or camera scan — transparent TrustScore with evidence.</Muted>

        <View style={styles.tabs}>
          {tabs.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Card>
          {tab === "url" ? (
            <View style={styles.form}>
              <Label>URL</Label>
              <Input autoCapitalize="none" keyboardType="url" value={url} onChangeText={setUrl} placeholder="https://" />
              <Button
                title="Analyze URL"
                loading={loading}
                onPress={() => {
                  const normalized = normalizeUrl(url);
                  if (!normalized) {
                    notify("Invalid URL", "Enter a full link, e.g. https://example.com/post");
                    return;
                  }
                  setUrl(normalized);
                  void run({ type: "url", input_url: normalized });
                }}
              />
            </View>
          ) : null}

          {tab === "text" ? (
            <View style={styles.form}>
              <Label>Text</Label>
              <Input multiline value={text} onChangeText={setText} maxLength={5000} placeholder="Paste claim…" />
              <Button
                title="Analyze text"
                loading={loading}
                onPress={() => {
                  if (text.trim().length < 10) {
                    notify("Too short", "At least 10 characters.");
                    return;
                  }
                  void run({ type: "text", input_text: text.trim() });
                }}
              />
            </View>
          ) : null}

          {tab === "image" || tab === "scan" ? (
            <View style={styles.form}>
              <Muted>
                {tab === "scan"
                  ? isUnescoOcrConfigured()
                    ? "Photograph a post. OCR.space extracts text; review before analyzing."
                    : "Photograph a post. Configure OCR.space (or type the caption)."
                  : isUnescoOcrConfigured()
                    ? "Import a screenshot — OCR will extract text for review."
                    : "Import a screenshot or gallery image."}
              </Muted>
              <View style={styles.rowBtns}>
                {tab === "scan" ? (
                  <View style={{ flex: 1 }}>
                    <Button title="Camera" variant="secondary" onPress={() => pickImage(true)} />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Button title="Gallery" variant="secondary" onPress={() => pickImage(false)} />
                </View>
              </View>
              {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
              {ocrLoading ? (
                <View style={styles.ocrRow}>
                  <ActivityIndicator color={colors.teal} />
                  <Muted>
                    {isUnescoOcrConfigured() ? "Reading text (OCR.space)…" : "Reading text…"}
                  </Muted>
                </View>
              ) : null}
              {!ocrLoading && ocrMeta?.message ? <Muted>{ocrMeta.message}</Muted> : null}
              {!ocrLoading &&
              (ocrEngine === "ocrspace" || ocrEngine === "unesco") &&
              typeof ocrMeta?.confidence === "number" &&
              ocrMeta.confidence >= 0 ? (
                <Muted>
                  Engine: {ocrEngine === "ocrspace" ? "OCR.space" : "UNESCO OCR"} · confidence{" "}
                  {Math.round(ocrMeta.confidence)}%
                  {ocrMeta.action ? ` · ${ocrMeta.action}` : ""}
                </Muted>
              ) : null}
              {!ocrLoading && ocrEngine === "native" ? (
                <Muted>Text extracted on-device — edit if needed.</Muted>
              ) : null}
              {!ocrLoading && ocrEngine === "none" && !ocrMeta?.message ? (
                <Muted>No OCR engine available. Type or paste the caption below.</Muted>
              ) : null}
              <Label>Caption / OCR text</Label>
              <Input
                multiline
                value={ocrHint}
                onChangeText={setOcrHint}
                placeholder="Extracted or typed caption…"
              />
              <Button title="Run TrustLens" loading={loading} onPress={uploadAndAnalyzeImage} />
            </View>
          ) : null}

          <View style={styles.consent}>
            <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.teal, false: colors.borderSolid }} />
            <Text style={styles.consentText}>
              I consent to AI processing of my submission. Analysis may be incomplete. Withdraw in Profile.
            </Text>
          </View>
        </Card>

        <Button title="Paste from clipboard" variant="ghost" onPress={pasteClipboard} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Extra bottom space so last controls clear the taller safe-area tab bar
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 12, paddingTop: 8 },
  tabs: { flexDirection: "row", gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.navyMid, borderColor: colors.teal },
  tabText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  tabTextActive: { color: colors.white },
  form: { gap: 10 },
  consent: { flexDirection: "row", gap: 10, marginTop: 16, alignItems: "flex-start" },
  consentText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 18 },
  rowBtns: { flexDirection: "row", gap: 8 },
  preview: { width: "100%", height: 180, borderRadius: 12, backgroundColor: colors.borderSolid },
  ocrRow: { flexDirection: "row", gap: 8, alignItems: "center" },
});
