import { StyleSheet } from "react-native";
import { radius, spacing, fontSize } from "../../theme/tokens";

// Shared style factory for PalmScreen + every section. Passed to
// useStyles(makeStyles) so colors react to runtime theme changes.
export const makeStyles = (c) => StyleSheet.create({
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.accentSoft,
    marginBottom: spacing.md,
  },
  backText: { color: c.accentLight, fontSize: 14, fontWeight: "600" },

  heroLabel: { color: c.primaryLight, fontSize: 15, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" },
  heroSub:   { color: c.textMuted, fontSize: 13, marginTop: 4, textAlign: "center" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 28, fontWeight: "700", marginBottom: 4, includeFontPadding: false },
  cardSub:   { color: c.textMuted, fontSize: 13, marginBottom: spacing.md },

  // "Palmistry Math" measured-geometry chips.
  geoChip:     { borderWidth: 1, borderColor: "rgba(168,85,247,0.35)", backgroundColor: "rgba(168,85,247,0.1)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  geoChipText: { color: "#c4b5fd", fontSize: 11.5, fontWeight: "600" },

  // Privacy assurance row on the palm picker (truthful: image never stored).
  privacyRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", backgroundColor: "rgba(34,197,94,0.06)" },
  privacyIcon: { fontSize: 14, lineHeight: 20, includeFontPadding: false },
  privacyText: { flex: 1, color: "#86efac", fontSize: 11.5, lineHeight: 16 },

  aiBusyCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1.5,
    borderColor: c.warning,
  },
  errTitle: { color: c.danger, fontSize: 16, fontWeight: "600", marginTop: 6 },
  errBody:  { color: c.textDim, fontSize: 14.5, textAlign: "center", lineHeight: 20, marginVertical: 8 },
  // Inline rejection text on the upload card — mirrors PalmStepScreen.error
  // (was previously undefined, causing the dark/black empty-text look).
  error:    { color: c.danger, fontSize: 15, textAlign: "center" },

  historyRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(168,85,247,0.25)", backgroundColor: "rgba(168,85,247,0.06)",
    marginBottom: 8,
  },
  historyTitle: { color: c.textBody, fontSize: 15, fontWeight: "600", flex: 1 },
  historyDate:  { color: c.textMuted, fontSize: 13 },

  uploadTitle: { color: c.text, fontSize: 18, fontWeight: "600", marginBottom: 6 },
  uploadHint:  { color: c.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 },
  costPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft,
  },
  costPillText: { fontSize: 13, fontWeight: "600" },

  uploadHandBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 16, paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft,
    width: "100%",
  },
  // Premium-flavored variant for the Both-Hands entry — brighter border so
  // it reads as the headline card. Mirrors PalmStepScreen.bothBtn.
  uploadBothBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 18, paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: c.primaryLight,
    backgroundColor: c.primarySoft,
    width: "100%",
  },
  uploadHandIcon: {
    fontSize: 30, lineHeight: 40, width: 44,
    textAlign: "center", textAlignVertical: "center", includeFontPadding: false,
  },
  // Wider variant for the Both-Hands button — single-emoji width (36) was
  // clipping the second emoji of "✋🤚".
  uploadBothIcon: {
    fontSize: 28, lineHeight: 40, width: 68,
    textAlign: "center", textAlignVertical: "center", includeFontPadding: false,
  },
  // Split-glyph variant — each emoji in its own Text view side-by-side,
  // works around Android's joined-run clipping.
  uploadBothIconWrap: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    width: 68, height: 40,
  },
  uploadBothIconGlyph: {
    fontSize: 26, lineHeight: 36, marginHorizontal: 1,
    includeFontPadding: false,
  },
  uploadHandLabel: { color: c.text, fontSize: 16, fontWeight: "700" },
  uploadHandSub:   { color: c.textMuted, fontSize: 14, marginTop: 2 },
  chev:            { fontSize: 26, fontWeight: "700", paddingHorizontal: 6 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: c.primaryBorder,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { color: c.text, fontSize: 16, fontWeight: "600", textAlign: "center", marginBottom: 4 },
  sourceBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: 16, paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.cardBorder,
    backgroundColor: c.cardBg,
  },
  sourceBtnPrimary: { borderColor: c.primaryBorder, backgroundColor: c.primarySoft },
  sourceIcon: { fontSize: 30, lineHeight: 40, width: 44, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
  sourceLabel:{ color: c.text, fontSize: 17, fontWeight: "700" },
  sourceSub:  { color: c.textMuted, fontSize: 14, marginTop: 2 },
  modalCancel:{ paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radius.lg, alignItems: "center", marginTop: 4 },
  modalCancelText: { color: c.textDim, fontSize: 16, fontWeight: "600" },

  handBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(168,85,247,0.5)",
    backgroundColor: "rgba(168,85,247,0.12)",
    marginBottom: 12,
  },
  handBadgeIcon: { fontSize: 16, lineHeight: 22, includeFontPadding: false },
  handBadgeText: { color: c.primaryLight, fontSize: 14, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },

  scanFrame: {
    width: "100%", maxWidth: 340, aspectRatio: 3 / 4,
    borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.4)",
    marginBottom: 16,
    position: "relative",
  },
  scanImage: { width: "100%", height: "100%" },
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 4,
    backgroundColor: "#c084fc",
    shadowColor: "#c084fc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 10,
    elevation: 8,
  },
  scanMsg: { fontSize: 16, fontWeight: "600", color: c.primaryLight, marginTop: 4 },
  scanSub: { fontSize: 13, color: c.textMuted, marginTop: 4 },

  palmPhoto: {
    width: "100%", maxWidth: 340, alignSelf: "center",
    borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.3)",
  },

  summary: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.3)",
    borderRadius: radius.xl, padding: spacing.xl,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  summaryLabel: {
    color: c.primary, fontSize: 14, fontWeight: "700",
    letterSpacing: 3, textTransform: "uppercase", marginBottom: 8,
  },
  summaryVibe: {
    color: c.text, fontSize: 19, fontStyle: "italic", textAlign: "center", lineHeight: 28,
  },

  // Emoji needs a generous lineHeight + no extra font padding, else Android
  // clips the glyph's top/bottom. Fixed width keeps the titles aligned.
  lineIcon:  { fontSize: 26, lineHeight: 36, width: 38, marginRight: 8, textAlign: "center", includeFontPadding: false },
  lineTitle: { color: c.text, fontSize: 17, lineHeight: 24, fontWeight: "700", letterSpacing: 0.5 },
  lineBody:  { color: c.textDim, fontSize: 15, lineHeight: 24 },

  halfCard:  { padding: spacing.md },
  halfTitle: { fontSize: 16, lineHeight: 24, fontWeight: "700", marginBottom: 12, includeFontPadding: false },
  bulletRow: { flexDirection: "row", marginBottom: 8 },
  bulletText:{ flex: 1, color: c.textDim, fontSize: 15.5, lineHeight: 21 },

  guideBlock: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    borderLeftWidth: 3, marginBottom: 12,
  },
  guideHead: { fontSize: 12, letterSpacing: 1.5, fontWeight: "700", marginBottom: 4 },
  guideBody: { color: c.textBody, fontSize: 15, lineHeight: 23 },

  noteRow: {
    flexDirection: "row", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: c.inputBg,
    borderLeftWidth: 3, borderLeftColor: c.accent,
    marginBottom: 8,
  },
  noteText: { flex: 1, color: c.textDim, fontSize: 13, lineHeight: 19 },

  revealBtn: {
    paddingVertical: 12, borderRadius: 10, marginTop: spacing.sm, alignItems: "center",
    borderWidth: 1, borderColor: c.primaryBorder, backgroundColor: c.primarySoft,
  },
  revealText: { color: c.primaryLight, fontSize: 13, fontWeight: "600" },

  disclaimer: {
    fontSize: 11, color: c.textFaint, textAlign: "center",
    marginTop: spacing.xl, lineHeight: 18,
  },

  // ── Both-Hands comparison view ──
  compareTile: { flex: 1, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(168,85,247,0.3)", backgroundColor: c.cardBgSolid },
  compareImageWrap: { width: "100%", aspectRatio: 3 / 4, backgroundColor: "#0f0e20" },
  compareHand: { textAlign: "center", color: c.primaryLight, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700", marginTop: 8 },
  compareSub:  { textAlign: "center", color: c.textMuted, fontSize: 12, marginTop: 2, marginBottom: 8 },

  compareLink: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(192,132,252,0.4)",
    backgroundColor: "rgba(168,85,247,0.10)", alignItems: "center",
  },
  compareLinkText: { color: c.primaryLight, fontSize: 12.5, fontWeight: "600" },

  rejectThumb: {
    width: 140, height: 140,
    borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.45)",
    marginBottom: 12,
  },
  rejectRow: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: c.cardBgSolid,
    marginBottom: 10,
  },
  rejectRowIcon:  { fontSize: 26, lineHeight: 34 },
  rejectRowSide:  { color: c.warning, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },
  rejectRowTitle: { color: c.danger, fontSize: 14, fontWeight: "700", marginTop: 4 },
  rejectRowTip:   { color: c.textDim, fontSize: 12.5, marginTop: 4, lineHeight: 18 },

  rejectTitle:  { fontSize: 16, fontWeight: "700", color: c.danger, marginTop: 12 },
  rejectTip:    { fontSize: 13.5, color: c.textDim, textAlign: "center", lineHeight: 22, marginVertical: 6 },
  rejectReason: { fontSize: 12, color: c.textMuted, textAlign: "center", lineHeight: 19, fontStyle: "italic", marginTop: 6 },
});
