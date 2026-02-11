import { StyleSheet } from "react-native";
import { COLORS } from "../theme/colors";

export const commonStyles = StyleSheet.create({
  // 화면 기본 레이아웃
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // 스크롤 컨테이너
  scrollContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 42,
    gap: 14,
  },

  // 카드 스타일
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  // 타이틀 (로고 스타일)
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.primaryText,
    marginBottom: 12,
  },

  // 서브타이틀
  subtitle: {
    fontSize: 15,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },

  // 본문 텍스트
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.secondaryText,
  },

  // 라벨 텍스트
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryText,
    marginBottom: 8,
  },

  // 입력 필드
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.softBorder,
    borderWidth: 1,
    borderRadius: 16,
    color: COLORS.primaryText,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },

  // 버튼 스타일
  button: {
    backgroundColor: COLORS.accentPink,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: COLORS.primaryText,
    fontWeight: "600",
    fontSize: 15,
  },

  // 보조 버튼
  secondaryButton: {
    backgroundColor: COLORS.accentLavender,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  // 로딩 상태
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: COLORS.secondaryText,
    fontSize: 15,
  },

  // 빈 상태
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    textAlign: "center",
  },

  // 프리미엄 배지
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
    marginBottom: 4,
  },

  premiumLogo: {
    width: 28,
    height: 28,
  },

  premiumText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.accentPeach,
  },

  // 행 레이아웃
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // 섹션 타이틀
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primaryText,
    marginTop: 8,
    marginBottom: 8,
  },
});

// 버튼 변형
export const buttonVariants = {
  primary: {
    backgroundColor: COLORS.accentPink,
  },
  secondary: {
    backgroundColor: COLORS.accentLavender,
  },
  peach: {
    backgroundColor: COLORS.accentPeach,
  },
  mint: {
    backgroundColor: COLORS.accentMint,
  },
  danger: {
    backgroundColor: COLORS.danger,
  },
} as const;
