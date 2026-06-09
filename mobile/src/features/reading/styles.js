import { StyleSheet } from "react-native";
import { radius, spacing, fontSize } from "../../theme/tokens";

// Shared style factory for ReadingScreen + every tab section. Passed to
// useStyles(makeStyles) so colors react to runtime theme changes.
export const makeStyles = (c) => StyleSheet.create({
  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accentBorder,
    backgroundColor: c.accentSoft,
    marginBottom: spacing.md,
  },
  backText: { color: c.accentLight, fontSize: 14, fontWeight: "600" },

  // Insights lock-by-default preview card.
  lockTitle: { color: c.text, fontSize: 20, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  lockBody:  { color: c.textBody, fontSize: 15, lineHeight: 22, textAlign: "center", paddingHorizontal: spacing.sm },
  lockNote:  { color: c.textMuted, fontSize: 13, marginTop: spacing.sm, textAlign: "center" },

  heroLabel: { color: c.primaryLight, fontSize: 15, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", textAlign: "center" },
  heroSub:   { color: c.textMuted, fontSize: 14, marginTop: 4, textAlign: "center" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerTitleWrap: { flex: 1 },

  row3:    { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  bigThree: {
    flex: 1,
    backgroundColor: c.cardBgSolid,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  bigThreeLabel: { fontSize: 13, color: c.textMuted, textTransform: "uppercase", marginBottom: 4 },
  // Zodiac glyph on its own line above the name so every card stacks the same
  // way regardless of name length (short "Leo" vs long "Sagittarius").
  bigThreeGlyph: { fontSize: 20, lineHeight: 26, marginBottom: 2, textAlign: "center" },
  bigThreeValue: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: c.text, textAlign: "center", alignSelf: "stretch" },

  cardTitle: { color: c.text, fontSize: fontSize.md, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
  cardSub:   { color: c.textMuted, fontSize: 13, marginBottom: spacing.md },
  body:      { color: c.textBody, fontSize: fontSize.sm, lineHeight: 22 },

  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  styleBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: c.cardBorder,
  },
  styleBtnActive: { borderColor: c.accent, backgroundColor: c.accentSoft },
  styleBtnText:   { color: c.textDim, fontSize: 13 },
  legend:         { color: c.textFaint, fontSize: 12, textAlign: "center", marginTop: spacing.md, letterSpacing: 0.5 },

  scoreRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  scoreLabel: { color: c.textDim, fontSize: 14 },
  scoreValue: { fontWeight: "700", fontSize: 15 },
  scoreMax:   { color: c.textFaint, fontWeight: "400", fontSize: 12 },
  barTrack: {
    height: 8, backgroundColor: c.inputBg,
    borderRadius: radius.pill, overflow: "hidden",
  },

  tableHeader: {
    flexDirection: "row", paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: c.cardBorder,
  },
  thCell: { fontSize: 13, color: c.textMuted, letterSpacing: 0.5 },
  tableRow: {
    flexDirection: "row", paddingVertical: 12, alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
  },
  tdCell: { fontSize: 15, lineHeight: 22, color: c.textBody },

  dashaCurrent: {
    backgroundColor: c.accentSoft,
    borderWidth: 1, borderColor: c.accentBorder,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  dashaTitle: { color: c.text, fontWeight: "600", fontSize: 16 },
  dashaDates: { color: c.textDim, fontSize: 14, marginVertical: 8 },
  dashaRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder,
  },
  dashaRowLabel: { color: c.textDim, fontSize: 15 },
  dashaRowDate:  { color: c.textMuted, fontSize: 14 },

  timelineItem:  { borderLeftWidth: 2, paddingLeft: 12, marginBottom: 16 },
  tlHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tlPeriod:      { fontSize: 15, fontWeight: "600", color: c.text },
  tlNow:         { fontSize: 11, color: c.success, fontWeight: "700" },
  tlPhase:       { fontSize: 12, fontWeight: "600", borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tlDates:       { fontSize: 13, color: c.textMuted, marginTop: 2, marginBottom: 6 },
  tlSummary:     { fontSize: 11.5, color: c.textDim, marginBottom: 7, lineHeight: 17 },
  tlHouse:       { fontSize: 9.5, color: c.textMuted, backgroundColor: c.inputBg, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },

  confRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confTheme:  { color: c.text, fontSize: 12.5 },
  confCount:  { color: c.textMuted, fontSize: 10 },
  confLevel:  { fontSize: 10, fontWeight: "700", borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  confSup:    { fontSize: 10.5, color: c.success, marginTop: 3 },

  sadeBad:  { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 14 },
  sadeGood: { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)", borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 14 },
  transitRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.cardBorder },

  aiBusyCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1.5,
    borderColor: c.warning,
  },
  aiBusyTitle: { color: c.warning, fontSize: 15, fontWeight: "700", textAlign: "center", marginTop: 8 },
  aiBusyBody:  { color: c.textBody, fontSize: 12.5, textAlign: "center", marginVertical: 12, lineHeight: 18 },
  loadingTitle: { color: c.text, fontSize: 16, fontWeight: "500", marginBottom: 8, textAlign: "center" },
  loadingSub:   { color: c.textMuted, fontSize: 12 },

  // ── Cosmic Blueprint hero ────────────────────────────────────────
  blueprint: {
    backgroundColor: c.primarySoft,
    borderWidth: 1, borderColor: c.primaryBorder,
    borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.md,
    alignItems: "center",
  },
  blueprintLabel: {
    color: c.primary, fontSize: 11, fontWeight: "800",
    letterSpacing: 4, marginBottom: 12,
  },
  blueprintDivider: {
    width: 36, height: 2, backgroundColor: c.primaryLight,
    borderRadius: 1, marginBottom: 14,
  },
  blueprintText: {
    color: c.text, fontSize: 18, fontStyle: "italic",
    textAlign: "center", lineHeight: 28, fontWeight: "500",
  },
  blueprintFooter: {
    color: c.textMuted, fontSize: 10, letterSpacing: 1,
    marginTop: 14, textTransform: "uppercase",
  },

  // ── Numbered narrative card ──────────────────────────────────────
  narrativeCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderLeftWidth: 4,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  narrativeHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  numberBadge: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: c.inputBg,
  },
  numberBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  narrativeTitle:  { flex: 1, color: c.text, fontSize: 15, lineHeight: 22, fontWeight: "700" },
  narrativeBody:   { color: c.textBody, fontSize: 13.5, lineHeight: 23 },

  // ── Strengths / Growth panel cards ───────────────────────────────
  panelCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  panelHead:   { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  panelDot:    { width: 8, height: 8, borderRadius: 4 },
  panelTitle:  { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  chip: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1,
    marginBottom: 8,
  },
  chipMark: { fontSize: 14, fontWeight: "700", marginRight: 8, marginTop: 1 },
  chipText: { flex: 1, color: c.textBody, fontSize: 13, lineHeight: 20 },

  // ── Key Placements ───────────────────────────────────────────────
  placementSection: { marginBottom: spacing.md },
  sectionLabel: {
    color: c.text, fontSize: 11, fontWeight: "800",
    letterSpacing: 2.5, marginBottom: 4,
  },
  sectionSub: { color: c.textMuted, fontSize: 11, marginBottom: spacing.md },
  placementCard: {
    flexDirection: "row",
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 10,
    gap: 12, alignItems: "flex-start",
  },
  placementGlyph: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: c.accentSoft,
    borderWidth: 1, borderColor: c.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  placementGlyphText: { color: c.accentLight, fontSize: 11, fontWeight: "800" },
  placementBody:      { flex: 1, color: c.textBody, fontSize: 13.5, lineHeight: 22 },

  // ── Remedies action steps ────────────────────────────────────────
  remedySection: {
    backgroundColor: c.primarySoft,
    borderWidth: 1, borderColor: c.primaryBorder,
    borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md,
  },
  remedyRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 12 },
  remedyNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: c.primary, alignItems: "center", justifyContent: "center",
  },
  remedyNumText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  remedyBody:    { flex: 1, color: c.text, fontSize: 13.5, lineHeight: 22, fontWeight: "500" },

  // ── Footer CTA ───────────────────────────────────────────────────
  footerCard: {
    backgroundColor: c.cardBgSolid,
    borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md, marginBottom: spacing.md,
    alignItems: "center",
  },
  footerKicker: {
    color: c.primaryLight, fontSize: 10, fontWeight: "700",
    letterSpacing: 3, marginBottom: 6,
  },
  footerTitle: { color: c.text, fontSize: 18, lineHeight: 24, fontWeight: "700" },
  footerBody:  { color: c.textDim, fontSize: 12.5, lineHeight: 18, textAlign: "center", marginTop: 6 },

  disclaimer: {
    fontSize: 11, color: c.textFaint, textAlign: "center",
    marginTop: spacing.xl, lineHeight: 18, letterSpacing: 0.5,
  },

  dayBtn: {
    width: 50, paddingVertical: 7, borderRadius: 12, alignItems: "center",
    borderWidth: 1, borderColor: c.cardBorder,
    backgroundColor: c.inputBg,
    position: "relative",
  },
  dayBtnActive:  { borderColor: c.primaryBorder, backgroundColor: c.primarySoft },
  dayBtnHasData: { borderColor: "rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.08)" },
  dayBtnTop:     { fontSize: 9, color: c.textDim, letterSpacing: 0.5 },
  dayBtnNum:     { fontSize: 16, fontWeight: "700", color: c.text },
  dayBtnMo:      { fontSize: 8, color: c.textMuted, opacity: 0.7 },
  dayDot:        { position: "absolute", top: 4, right: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: c.success },

  alignPct: { fontSize: 26, fontWeight: "800", color: c.primaryLight, marginTop: spacing.sm },
  dayTitle: { fontSize: 15, fontWeight: "700", color: c.text, marginTop: 6 },
  dayIntro: { fontSize: 13, color: c.textDim, lineHeight: 21, marginTop: 4, marginBottom: 8 },
  dayMeta:  { fontSize: 11, color: c.textMuted, marginVertical: 4 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: spacing.md },
  chip: {
    minWidth: 120, flexGrow: 1,
    backgroundColor: c.inputBg,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  chipLabel: { fontSize: 9, color: c.textMuted, letterSpacing: 1 },
  chipValue: { fontSize: 12.5, fontWeight: "700", color: c.textBody, marginTop: 3 },

  action: { borderLeftWidth: 2, borderLeftColor: c.primaryLight, paddingLeft: 12, marginBottom: 14 },
  actionLabel: { fontSize: 10, color: c.textMuted, letterSpacing: 1 },
  actionText:  { fontSize: 13.5, color: c.textBody, fontStyle: "italic", marginTop: 3 },

  revealBtn: {
    paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: c.primaryBorder,
    backgroundColor: c.primarySoft, alignItems: "center",
  },
  revealText: { color: c.primaryLight, fontSize: 13, fontWeight: "600" },

  guideLabel: { fontSize: 10, color: c.primary, letterSpacing: 1.5, fontWeight: "600", marginBottom: 2 },
  guideText:  { fontSize: 12.5, color: c.textDim, lineHeight: 20 },
});
