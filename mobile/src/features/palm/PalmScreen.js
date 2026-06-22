import React from "react";
import { View, Text } from "react-native";
import AnimatedRE, { FadeIn, FadeInRight } from "react-native-reanimated";
import ScreenContainer from "../../components/ScreenContainer";
import MenuButton from "../../components/MenuButton";
import LowCreditsCard from "../../components/LowCreditsCard";
import { SkeletonPalm } from "../../components/Skeleton";
import { useBackToKundali } from "../../utils/useBackToKundali";
import { useColors } from "../../theme/ThemeContext";
import { useStyles } from "../../theme/useStyles";
import { spacing } from "../../theme/tokens";
import { makeStyles } from "./styles";
import { usePalmReading } from "./usePalmReading";
import CompareView from "./sections/CompareView";
import OverloadedCard from "./sections/OverloadedCard";
import PastReadings from "./sections/PastReadings";
import UploadView from "./sections/UploadView";
import ReadingResult from "./sections/ReadingResult";
import RejectView from "./sections/RejectView";
import SourcePickerModal from "./sections/SourcePickerModal";

export default function PalmScreen({ navigation }) {
  const color = useColors();
  const s = useStyles(makeStyles);

  // All state, effects, and handlers live in the hook — this component is the
  // render layer only.
  const vm = usePalmReading();

  // Android hardware back → Reading/Kundali instead of exiting the app.
  useBackToKundali(navigation);

  // Shared "not enough credits" card for both views.
  const lowCreditsCard = vm.cannotAfford ? (
    <LowCreditsCard cost={vm.palmCost} action="A palm reading" onTopUp={() => navigation.navigate("Credits", { returnTo: "Palm" })} />
  ) : null;

  if (vm.inCompareMode) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <ScreenContainer showMenu={false} padH={spacing.sm}>
          <View style={s.headerRow}>
            <MenuButton />
            <View style={{ flex: 1 }}>
              <Text style={s.heroLabel} numberOfLines={1}>Full Life Comparison</Text>
              <Text style={s.heroSub} numberOfLines={1}>Photos discarded after analysis</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {lowCreditsCard}

          <CompareView
            palmComparison={vm.palmComparison}
            palmLeftPhoto={vm.palmLeftPhoto}
            palmRightPhoto={vm.palmRightPhoto}
            palmAnalyzing={vm.palmAnalyzing}
            palmOverloaded={vm.palmOverloaded}
            cooldown={vm.cooldown}
            scanMsg={vm.scanMsg}
            scanAnim={vm.scanAnim}
            setPalmComparison={vm.setPalmComparison}
            setPalmLeftPhoto={vm.setPalmLeftPhoto}
            setPalmRightPhoto={vm.setPalmRightPhoto}
            setPalmAnalyzing={vm.setPalmAnalyzing}
            setPalmOverloaded={vm.setPalmOverloaded}
            navigation={navigation}
            reset={vm.reset}
          />
        </ScreenContainer>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScreenContainer showMenu={false} padH={spacing.sm}>
        <View style={s.headerRow}>
          <MenuButton />
          <View style={{ flex: 1 }}>
            <Text style={s.heroLabel} numberOfLines={1}>Palm Insights</Text>
            <Text style={s.heroSub} numberOfLines={1}>Photo discarded after analysis</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {vm.hydrating ? (
          <SkeletonPalm />
        ) : (
          <>
            {!vm.palm && !vm.scanning && lowCreditsCard}

            {vm.overloaded && !vm.palm && (
              <OverloadedCard
                cooldown={vm.cooldown}
                preview={vm.preview}
                runAnalyze={vm.runAnalyze}
                setOverloaded={vm.setOverloaded}
              />
            )}

            {/* Past readings */}
            {!vm.palm && !vm.scanning && vm.history.length > 0 && (
              <AnimatedRE.View entering={FadeInRight.duration(400).springify()}>
                <PastReadings history={vm.history} loadPast={vm.loadPast} />
              </AnimatedRE.View>
            )}

            {/* Upload / scanning view */}
            {!vm.palm && (
              <AnimatedRE.View entering={FadeIn.duration(400)}>
                <UploadView
                  navigation={navigation}
                  setActiveHand={vm.setActiveHand}
                  setError={vm.setError}
                  gating={vm.gating}
                  error={vm.error}
                  preview={vm.preview}
                  scanning={vm.scanning}
                  activeHand={vm.activeHand}
                  claimedHand={vm.palmClaimedHand}
                  scanAnim={vm.scanAnim}
                  scanMsg={vm.scanMsg}
                  palmCost={vm.palmCost}
                  cannotAfford={vm.cannotAfford}
                  palmLandmarks={vm.palmLandmarks}
                  gateReport={vm.gateReport}
                  gateConfidence={vm.gateConfidence}
                />
              </AnimatedRE.View>
            )}

            {/* Reading view */}
            {vm.palm && !vm.unusable && (
              <AnimatedRE.View entering={FadeIn.duration(400)}>
                <ReadingResult palm={vm.palm} preview={vm.preview} reset={vm.reset} />
              </AnimatedRE.View>
            )}

            {/* Unusable */}
            {vm.palm && vm.unusable && (
              <AnimatedRE.View entering={FadeIn.duration(400)}>
                <RejectView palm={vm.palm} preview={vm.preview} reset={vm.reset} />
              </AnimatedRE.View>
            )}
          </>
        )}
      </ScreenContainer>

      {/* Source-picker modal — appears after the user taps a hand card. */}
      <SourcePickerModal
        visible={vm.activeHand !== null && !vm.scanning && !vm.gating && !vm.palm && !vm.palmAnalyzing}
        activeHand={vm.activeHand}
        onClose={() => vm.setActiveHand(null)}
        pick={vm.pick}
        launching={vm.launching}
      />
    </View>
  );
}
