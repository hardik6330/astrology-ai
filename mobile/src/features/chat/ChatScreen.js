import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, FlatList, Pressable,
  Keyboard, Platform, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import MenuButton from "@/components/MenuButton";
import { useChart } from "@/context/ChartContext";
import { chatCompletion, fetchChatHistory } from "@/services/api";
import { buildFactSheet } from "@/shared/astrology";
import { SkeletonChat } from "@/components/Skeleton";
import { logEvent } from "@/features/notifications/analytics";
import { useColors } from "@/theme/ThemeContext";
import { useStyles } from "@/theme/useStyles";
import { radius, spacing, fontSize } from "@/theme/tokens";
import { useBackToKundali } from "@/utils/useBackToKundali";

const SUGGESTIONS = [
  "When will I marry?",
  "How is my career future?",
  "What does my current dasha mean?",
  "Will I settle abroad?",
];

const PLACEHOLDERS = [
  "Ask about your future…",
  "When will I marry?",
  "How is my career going?",
  "What does my dasha say?",
  "Is this a good time for change?",
];

export default function ChatScreen({ navigation }) {
  const { form, chart, chatMsgs, setChatMsgs } = useChart();
  useBackToKundali(navigation);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [phIdx, setPhIdx]   = useState(0);
  const [phText, setPhText] = useState("");
  const [kbHeight, setKbHeight] = useState(0);
  const listRef = useRef(null);

  // SDK 54 enables Android edge-to-edge, so `adjustResize` no longer shrinks
  // the window and KeyboardAvoidingView can't lift the input. Track the
  // keyboard height ourselves and pad the container by it — works on both
  // platforms regardless of windowSoftInputMode. iOS uses the *Will* events
  // for a smooth slide; Android only fires the *Did* events reliably.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => setKbHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKbHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, []);

  useEffect(() => {
    const full = PLACEHOLDERS[phIdx];
    let i = 0, deleting = false, t;
    const tick = () => {
      if (!deleting) {
        i++;
        setPhText(full.slice(0, i));
        if (i >= full.length) {
          deleting = true;
          t = setTimeout(tick, 1400);
          return;
        }
        t = setTimeout(tick, 55);
      } else {
        i--;
        setPhText(full.slice(0, i));
        if (i <= 0) {
          setPhIdx((p) => (p + 1) % PLACEHOLDERS.length);
          return;
        }
        t = setTimeout(tick, 30);
      }
    };
    t = setTimeout(tick, 80);
    return () => clearTimeout(t);
  }, [phIdx]);
  const color = useColors();
  const s = useStyles(makeStyles);

  const welcomeMsg =
    `Namaste ${form.name || "there"} 🙏 I'm your personal Vedic astrologer. ` +
    `Ask me anything about your life — career, marriage, money, health, timing — and ` +
    `I'll answer from your kundali. What would you like to know?`;

  // Restore saved history when the screen mounts AND once the form is ready.
  // The form may still be hydrating from AsyncStorage / login on first mount,
  // so we re-run when form identity changes. The chatMsgs guard prevents a
  // duplicate fetch after we've already populated the list.
  useEffect(() => {
    if (chatMsgs.length > 0) { setHydrating(false); return; }
    if (!form?.name || !form?.date || !form?.time || !form?.city) { setHydrating(false); return; }
    let cancelled = false;
    setHydrating(true);
    fetchChatHistory(form)
      .then((msgs) => { if (!cancelled && msgs.length) setChatMsgs(msgs); })
      .finally(() => { if (!cancelled) setHydrating(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.name, form?.date, form?.time, form?.city, form?.gender]);

  // Keep list pinned to latest message.
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
  }, [chatMsgs]);

  async function ask() {
    const q = input.trim();
    if (!q || busy || !chart) return;
    logEvent("chat_question_asked", { user_name: form.name });
    setInput("");
    const history = [...chatMsgs, { role: "user", content: q }];
    setChatMsgs([...history, { role: "assistant", content: "…" }]);
    setBusy(true);
    try {
      const txt = await chatCompletion(history, "chat", {
        factSheet: buildFactSheet(chart, form), form,
      });
      setChatMsgs((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content: txt || "(no response)" };
        return copy;
      });
    } catch (err) {
      setChatMsgs((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content: "Error: " + err.message };
        return copy;
      });
    }
    setBusy(false);
  }

  // Always keep the welcome message pinned at the top so the chat never feels
  // empty — even after the user has started a conversation.
  const data = [{ role: "assistant", content: welcomeMsg, welcome: true }, ...chatMsgs];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <Animated.View 
          entering={FadeInDown.duration(400).springify()}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, paddingBottom: kbHeight }}>
          {/* Header */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <View style={s.headerRow}>
              <MenuButton />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.headerTitle} numberOfLines={1}>Your Astrologer</Text>
                <Text style={s.headerSub} numberOfLines={1}>
                  {form.name ? `${form.name}'s chart` : "Your chart"}
                </Text>
              </View>
              <View style={{ width: 40 }} />
            </View>
          </View>

          {/* Messages */}
          {hydrating ? (
            <SkeletonChat />
          ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.md, gap: 10 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
            renderItem={({ item }) => {
              const isUser = item.role === "user";
              return (
                <View style={[s.bubbleRow, isUser ? { flexDirection: "row-reverse" } : { flexDirection: "row" }]}>
                  <View style={[s.avatar, isUser ? s.avatarUser : s.avatarAi]}>
                    <Text style={{ fontSize: 18, lineHeight: 24 }}>{isUser ? "🧑" : "🔮"}</Text>
                  </View>
                  <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAi]}>
                    <Text style={s.bubbleText}>{item.content}</Text>
                  </View>
                </View>
              );
            }}
          />
          )}

          {/* Input + suggestions */}
          <View style={[s.inputWrap, { paddingBottom: spacing.md }]}>
            {chatMsgs.length === 0 && (
              <View style={s.suggestionRow}>
                {SUGGESTIONS.map((q) => (
                  <Pressable key={q} onPress={() => setInput(q)} style={s.suggestion}>
                    <Text style={s.suggestionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={phText + "▍"}
                placeholderTextColor={color.textMuted}
                style={s.input}
                multiline
                editable={!busy}
                onSubmitEditing={ask}
              />
              <Pressable onPress={ask} disabled={busy || !input.trim()} style={[s.sendBtn, (busy || !input.trim()) && { opacity: 0.5 }]}>
                <Text style={s.sendText}>{busy ? "…" : "Ask"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.accentSoft,
    marginBottom: spacing.sm,
  },
  backText: { color: c.accentLight, fontSize: 12, fontWeight: "600" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerTitle: { color: c.primaryLight, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  headerSub:   { color: c.textMuted, fontSize: 11, marginTop: 2 },

  bubbleRow: { alignItems: "flex-start", gap: 8 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  avatarUser: { backgroundColor: c.accentSoft,  borderColor: c.accentBorder },
  avatarAi:   { backgroundColor: c.primarySoft, borderColor: c.primaryBorder },

  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
  },
  bubbleUser: { backgroundColor: c.accentSoft, borderColor: c.accentBorder },
  bubbleAi:   { backgroundColor: c.inputBg,    borderColor: c.cardBorder },
  bubbleText: { color: c.textBody, fontSize: 13.5, lineHeight: 22 },

  inputWrap: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: c.cardBorder,
    backgroundColor: c.bg,
  },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  suggestion: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft,
  },
  suggestionText: { color: c.accentLight, fontSize: 12 },

  input: {
    flex: 1,
    backgroundColor: c.inputBg,
    borderWidth: 1, borderColor: c.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    color: c.text, fontSize: fontSize.md, maxHeight: 110,
  },
  sendBtn: {
    paddingHorizontal: 18, justifyContent: "center", borderRadius: radius.md,
    borderWidth: 1, borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft,
  },
  sendText: { color: c.primaryLight, fontWeight: "700", fontSize: 13 },
});
