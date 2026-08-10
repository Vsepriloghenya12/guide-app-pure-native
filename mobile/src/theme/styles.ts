import { Platform, StatusBar, StyleSheet } from 'react-native';
import { ANDROID_NAVIGATION_BAR_INSET, ANDROID_STATUS_BAR_INSET, BOTTOM_TABS_VISIBLE_HEIGHT } from '../data/constants';
export let styles: Record<string, any> = {
  safeArea: { flex: 1, width: '100%', minWidth: '100%', backgroundColor: '#ffffff', margin: 0, padding: 0, alignSelf: 'stretch' },
  appHeader: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 10 : 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#d8e0ea', backgroundColor: '#f5f7fb' },
  logoText: { color: '#1f63c7', fontSize: 22, fontWeight: '900' },
  headerBackButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  headerBackText: { color: '#102a43', fontWeight: '800' },
  content: { flex: 1, width: '100%', minWidth: '100%', margin: 0, padding: 0, backgroundColor: '#ffffff' },
  contentInner: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: BOTTOM_TABS_VISIBLE_HEIGHT + 26, backgroundColor: '#ffffff' },
  homeContentInner: { flexGrow: 1, width: '100%', minWidth: '100%', padding: 0, paddingTop: 0, paddingBottom: BOTTOM_TABS_VISIBLE_HEIGHT + 22, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, margin: 0, backgroundColor: '#ffffff' },
  screenGap: { gap: 12 },
  tipsListScreen: { gap: 12, paddingBottom: 12 },
  flex: { flex: 1 },
  full: { width: '100%', height: '100%' },
  errorScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#ffffff' },
  errorTitle: { color: '#102a43', fontSize: 22, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  errorText: { color: '#62748b', fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  errorButton: { minHeight: 46, borderRadius: 16, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 18 },
  errorButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  homeRoot: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: '#ffffff' },
  homeHero: { width: '100%', minWidth: '100%', alignSelf: 'stretch', height: 150, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#1c65a0' },
  homeHeroImage: { resizeMode: 'cover' },
  homeHeroOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 },
  heroAuthButton: { position: 'absolute', right: 14, top: 12, zIndex: 4, width: 46, height: 46, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 18, 37, 0.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  heroAuthAvatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)' },
  heroAuthIcon: { color: '#ffffff', fontSize: 20, lineHeight: 23, fontWeight: '900' },
  homeBody: { width: '100%', minWidth: '100%', alignSelf: 'stretch', marginTop: -18, paddingHorizontal: 0, paddingLeft: 0, paddingRight: 0, gap: 14, backgroundColor: '#ffffff' },
  bannerStack: { width: '100%', minWidth: '100%', height: 168, justifyContent: 'center', overflow: 'hidden' },
  bannerScrollerContent: { alignItems: 'center' },
  homeBanner: { height: 126, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1f63c7' },
  homeBannerSlide: { height: 134, borderRadius: 22, backgroundColor: '#1f63c7', shadowColor: '#293d5d', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 8 },
  homeBannerImage: { borderRadius: 20 },
  homeBannerFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  bannerOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 },
  bannerDots: { position: 'absolute', left: 0, right: 0, bottom: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  bannerDot: { width: 18, height: 3, borderRadius: 999, backgroundColor: 'rgba(31, 99, 199, 0.18)' },
  bannerDotActive: { backgroundColor: '#1f63c7', width: 30 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginTop: 2, paddingHorizontal: 14 },
  quickItem: { width: '25%', alignItems: 'center', paddingHorizontal: 2 },
  quickIcon: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#dbe7ef' },
  quickLabel: { color: '#102a43', fontSize: 10.5, lineHeight: 12.5, fontWeight: '900', textAlign: 'center', marginTop: 7, minHeight: 26 },
  programSpotlight: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 8, alignItems: 'center', marginHorizontal: 14, marginTop: 2 },
  programBlob: { position: 'absolute', top: -32, right: -26, width: 130, height: 96, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.13)' },
  programEyebrow: { color: '#ffffff', opacity: 0.82, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  programTitle: { color: '#ffffff', fontSize: 20, lineHeight: 23, fontWeight: '900', textAlign: 'center', marginTop: 8, maxWidth: 260 },
  programText: { color: '#edf5ff', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 9, fontWeight: '700' },
  programChips: { flexDirection: 'row', gap: 8, marginTop: 14 },
  programChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' },
  programChipText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  programAction: { width: '100%', minHeight: 38, paddingTop: 11, borderRadius: 14, overflow: 'hidden', backgroundColor: '#ffffff', color: '#1f4f98', fontSize: 11, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  homeSection: { gap: 0, paddingHorizontal: 14 },
  homeSectionHeader: { minHeight: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  homeSectionHeaderSide: { width: 44, height: 32 },
  homeSectionTitle: { flex: 1, color: '#102a43', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  homeSectionAllButton: { width: 44, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center' },
  homeSectionLink: { color: '#1f63c7', fontSize: 13, fontWeight: '900' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 0, borderRadius: 0, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: 'rgba(23, 37, 64, 0.08)' },
  tipThumbPlaceholder: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4edf7' },
  tipThumbGlyph: { color: '#1f63c7', fontSize: 20, fontWeight: '900' },
  tipTitle: { color: '#102a43', fontSize: 14, fontWeight: '900' },
  tipText: { color: '#62748b', fontSize: 12, lineHeight: 16, marginTop: 3 },
  tipChevron: { color: '#96a6bb', fontSize: 24, lineHeight: 26, fontWeight: '500' },
  tipModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  tipModalCard: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff' },
  tipModalHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 999, backgroundColor: '#d8e0ea', marginBottom: 14 },
  tipModalEyebrow: { color: '#1f63c7', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  tipModalTitle: { color: '#102a43', fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 8 },
  tipModalText: { color: '#62748b', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 10 },
  tipModalButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', marginTop: 18 },
  tipModalButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  welcomeScreen: { flex: 1, width: '100%', backgroundColor: '#156db2' },
  welcomeBackgroundImage: { resizeMode: 'cover' },
  welcomeOverlay: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 22, backgroundColor: 'rgba(8, 24, 48, 0.28)' },
  welcomeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  welcomeLogo: { width: 190, height: 190 },
  welcomeText: { maxWidth: 310, color: '#ffffff', fontSize: 21, lineHeight: 28, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.36)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  welcomeButton: { width: '100%', minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', shadowColor: '#102a43', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 7 },
  welcomeButtonText: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  welcomePolicyText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  welcomePolicyLink: { color: '#ffffff', fontWeight: '900', textDecorationLine: 'underline' },

  sectionTitle: { color: '#102a43', fontSize: 20, fontWeight: '900', marginTop: 4 },
  screenHeader: { gap: 6, marginBottom: 4, paddingTop: 4 },
  screenTitle: { color: '#102a43', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  screenText: { color: '#62748b', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  searchInput: { minHeight: 50, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea', color: '#102a43', fontSize: 15, fontWeight: '700' },
  noteText: { color: '#62748b', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  contactCard: { padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea', shadowColor: '#293d5d', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  contactCardTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  contactCardText: { color: '#62748b', fontSize: 14, lineHeight: 20, marginTop: 5, fontWeight: '700' },
  contactValue: { color: '#1f63c7', fontSize: 16, fontWeight: '900', marginTop: 10 },
  legalLinksCard: { padding: 14, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', gap: 4 },
  legalLinksTitle: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900', marginBottom: 4 },
  legalLinkRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  legalLinkText: { color: '#1f63c7', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  legalLinkArrow: { color: '#8a9aae', fontSize: 22, lineHeight: 24, fontWeight: '700' },

  detailMapFallback: { minHeight: 128, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: '#eaf3ff', borderWidth: 1, borderColor: '#d8e4f2' },
  detailMapFallbackTitle: { color: '#102a43', fontSize: 15, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  detailMapFallbackText: { color: '#62748b', fontSize: 12.5, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  fullscreenImageBackdrop: { flex: 1, backgroundColor: 'rgba(2, 8, 23, 0.94)' },
  fullscreenImageCloseArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  fullscreenImage: { width: '100%', height: '86%' },
  fullscreenImageCloseButton: { position: 'absolute', top: 44, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImageCloseText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '600' },
  detailText: { color: '#62748b', fontSize: 16, lineHeight: 24 },
  infoBlock: { paddingVertical: 13, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)', gap: 4 },
  infoLabel: { color: '#62748b', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: '#102a43', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  infoValueLink: { color: '#1f63c7' },
  bulletinSafetyActions: { flexDirection: 'row', gap: 8 },
  bulletinSafetyButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 10 },
  bulletinSafetyText: { color: '#9a3412', fontSize: 12.5, lineHeight: 16, fontWeight: '900' },
  verificationModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: 'rgba(9, 19, 38, 0.42)' },
  verificationModalCard: { width: '100%', maxWidth: 340, borderRadius: 24, backgroundColor: '#ffffff', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  verificationModalImage: { width: 88, height: 88 },
  verificationModalTitle: { color: '#102a43', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  verificationModalText: { color: '#62748b', fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  verificationModalButton: { minHeight: 46, borderRadius: 15, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, marginTop: 18 },
  verificationModalButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  bulletText: { color: '#62748b', fontSize: 15, lineHeight: 22 },
  nativeMapCard: { width: '100%', borderRadius: 22, overflow: 'hidden', backgroundColor: '#e8f1f8', borderWidth: 1, borderColor: '#d8e0ea', justifyContent: 'center' },
  nativeMap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 },
  nativeMapMarkerHalo: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.92)', alignItems: 'center', justifyContent: 'center' },
  nativeMapMarkerHaloLarge: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255, 255, 255, 0.94)', alignItems: 'center', justifyContent: 'center' },
  nativeMapMarkerRouteDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#ffffff' },
  nativeMapMarkerPlaceDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ffffff', backgroundColor: '#e05a3f' },
  detailRouteExternalLink: { fontSize: 12.5, color: '#1f63c7', fontWeight: '700', textDecorationLine: 'underline' },
  routeMapStatusText: { fontSize: 13.5, fontWeight: '700', color: '#20304c', marginTop: 8 },
  mapFullscreenFallback: { alignItems: 'center', justifyContent: 'center', padding: 26, gap: 8 },
  // ── Редизайн карточки места (Карточка места.dc) ──
  detailHero: { position: 'relative', height: 440, backgroundColor: '#e8f1f8', overflow: 'hidden' },
  detailHeroFallback: { height: 440, backgroundColor: '#dce8f4' },
  detailHeroGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 104 },
  detailHeroTopRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  detailHeroTopActions: { flexDirection: 'row', gap: 8 },
  detailHeroCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  detailHeroBackGlyph: { color: '#20304c', fontSize: 22, fontWeight: '800', marginTop: -2 },
  detailHeroTitleRow: { position: 'absolute', left: 20, right: 112, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  detailHeroTitle: { color: '#ffffff', fontSize: 32, fontWeight: '900', flexShrink: 1 },
  detailHeroDots: { position: 'absolute', right: 20, bottom: 30, flexDirection: 'row', gap: 5 },
  detailHeroDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  detailHeroDotActive: { width: 16, backgroundColor: '#ffffff' },
  detailBody: { paddingHorizontal: 20, paddingTop: 16, gap: 15 },
  detailStatsStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#f5f7fb',
    borderWidth: 1,
    borderColor: '#e3e9f1',
    borderRadius: 16,
    paddingVertical: 12
  },
  detailStatsCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 0, paddingHorizontal: 4 },
  detailStatsDivider: { width: 1, backgroundColor: '#e3e9f1', marginVertical: 2 },
  detailStatsValue: { fontSize: 14, fontWeight: '900' },
  detailStatsStar: { color: '#f5a623' },
  detailStatsCaption: { color: '#8493a8', fontSize: 10.5, fontWeight: '700' },
  detailBadgeScroll: { marginHorizontal: -20 },
  detailBadgeRow: { paddingHorizontal: 20, gap: 7, flexDirection: 'row', alignItems: 'center' },
  detailBadgeGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff7e5',
    borderWidth: 1,
    borderColor: '#f2d58a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  detailBadgeGoldIcon: { width: 16, height: 16 },
  detailBadgeGoldText: { color: '#7a5c14', fontSize: 12, fontWeight: '800' },
  detailInfoRows: { backgroundColor: '#f5f7fb', marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 5 },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e3e9f1' },
  detailInfoRowLast: { borderBottomWidth: 0 },
  detailInfoRowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eef4fb', alignItems: 'center', justifyContent: 'center' },
  detailInfoRowGlyph: { fontSize: 16, color: '#1f63c7' },
  detailInfoRowText: { flex: 1, color: '#102a43', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  detailPaddedSection: { paddingHorizontal: 20, paddingTop: 15, gap: 9 },
  detailSectionHeading: { color: '#102a43', fontSize: 18, fontWeight: '900' },
  detailSimilarSection: { backgroundColor: '#f5f7fb', marginTop: 16, paddingVertical: 13 },
  detailSimilarScroll: { marginTop: 10 },
  detailSimilarRow: { paddingHorizontal: 20, gap: 10, flexDirection: 'row' },
  detailSimilarCard: { width: 150, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e9f1', borderRadius: 16, overflow: 'hidden' },
  detailSimilarImage: { width: '100%', height: 84, backgroundColor: '#e8f1f8' },
  detailSimilarImageFallback: { backgroundColor: '#dce8f4' },
  detailSimilarBody: { paddingHorizontal: 11, paddingVertical: 9, gap: 2 },
  detailSimilarTitle: { color: '#102a43', fontSize: 13, fontWeight: '800' },
  detailSimilarMeta: { color: '#62748b', fontSize: 11.5, fontWeight: '700' },
  detailHowToSection: { marginTop: 16 },
  detailHowToHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  detailHowToMeta: { color: '#e05a3f', fontSize: 13, fontWeight: '800' },
  detailMapFullNew: { marginTop: 10, overflow: 'hidden' },
  detailBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderTopWidth: 1,
    borderTopColor: '#e3e9f1',
    paddingHorizontal: 16,
    paddingTop: 12
  },
  detailBottomCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f63c7',
    borderRadius: 15,
    minHeight: 50
  },
  detailBottomCtaText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  offlineBanner: { backgroundColor: '#b3442e', paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' },
  offlineBannerText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  mapStuckOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1,
    backgroundColor: '#e8f1f8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  mapStuckText: { color: '#102a43', fontSize: 15, fontWeight: '800' },
  mapStuckButton: { backgroundColor: '#1f63c7', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 11 },
  mapStuckButtonText: { color: '#ffffff', fontSize: 13.5, fontWeight: '800' },
  clusterBubble: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 6,
    backgroundColor: '#1f63c7',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  clusterBubbleText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  mapControlButtonActive: { borderWidth: 2, borderColor: '#1f63c7' },
  // ── Строки списка категории (Прототип Твой гид.dc) ──
  listRow: {
    flexDirection: 'row',
    gap: 14,
    marginLeft: -14,
    // Compensates the parent containers' gap:10 so divider rows sit flush like a list
    marginVertical: -5,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f6',
    backgroundColor: '#ffffff'
  },
  listRowImage: { width: 120, minHeight: 150, alignSelf: 'stretch', backgroundColor: '#e8f1f8' },
  listRowImageFallback: { backgroundColor: '#dce8f4' },
  listRowBody: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 7, paddingVertical: 14, paddingRight: 2 },
  listRowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listRowTitle: { flex: 1, color: '#102a43', fontSize: 16, fontWeight: '900' },
  listRowBadge: { width: 28, height: 28 },
  listRowFact: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  listRowFactText: { flex: 1, color: '#35507a', fontSize: 13, fontWeight: '700' },
  listRowBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listRowRating: { color: '#102a43', fontSize: 13, fontWeight: '800' },
  // ── Шапка категории (Прототип Твой гид.dc) ──
  categoryHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryBackPill: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 8, flexShrink: 0 },
  categoryBackPillText: { color: '#102a43', fontWeight: '800', fontSize: 14 },
  categoryHeaderTitle: { flex: 1, minWidth: 0, textAlign: 'center', color: '#102a43', fontSize: 18, fontWeight: '900' },
  categoryHeaderCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ee', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cuisineChipsScroll: { marginHorizontal: -14, marginTop: 12 },
  cuisineChipsRow: { paddingHorizontal: 14, gap: 8, flexDirection: 'row' },
  cuisineChip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e9f1', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  cuisineChipActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  cuisineChipText: { color: '#35507a', fontSize: 13, fontWeight: '700' },
  cuisineChipTextActive: { color: '#ffffff', fontWeight: '800' },
  categoryTabsRow: { flexDirection: 'row', marginTop: 12, marginHorizontal: -14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#e3e9f1' },
  categoryTab: { flex: 1, alignItems: 'center', paddingTop: 2, paddingBottom: 11, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  categoryTabActive: { borderBottomColor: '#1f63c7' },
  categoryTabText: { color: '#8493a8', fontSize: 14, fontWeight: '700' },
  categoryTabTextActive: { color: '#102a43', fontWeight: '900' },
  categoryLocateNote: { color: '#62748b', fontSize: 12.5, fontWeight: '600', marginTop: 10, lineHeight: 17 },
  categoryMapFloatWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  categoryMapFloatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#102a43',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#0b2b57',
    shadowOpacity: 0.36,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7
  },
  categoryMapFloatText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  categoryMapCountChip: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5
  },
  categoryMapCountText: { color: '#102a43', fontSize: 13, fontWeight: '800' },
  mapFullscreenRoot: { flex: 1, backgroundColor: '#e8f1f8' },
  mapFullscreenClose: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 8
  },
  mapFullscreenCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 6,
    shadowColor: '#0b2b57',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12
  },
  mapFullscreenError: { fontSize: 13.5, color: '#b3442e', fontWeight: '600', lineHeight: 19 },
  mapFullscreenLinksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  nativeMapFlat: { width: '100%', overflow: 'hidden', backgroundColor: '#e8f1f8', justifyContent: 'center' },
  // ── Новый визуал (дизайн «Карта места») ──
  detailHeroChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(16, 42, 67, 0.55)' },
  detailHeroChipText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  detailPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 11, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e9f1' },
  detailPillText: { color: '#35507a', fontSize: 13, fontWeight: '700' },
  nativeMapPinMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e05a3f',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e05a3f',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6
  },
  nativeMapUserRing: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(31, 99, 199, 0.26)', alignItems: 'center', justifyContent: 'center' },
  nativeMapUserDotNew: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#1f63c7', borderWidth: 3, borderColor: '#ffffff' },
  nativeMapPopupThumb: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#dfe7f0' },
  nativeMapPopupMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  nativeMapPopupDistance: { color: '#e05a3f', fontSize: 11, fontWeight: '800' },
  nativeMapPopupDot: { color: '#c2ccda', fontSize: 11 },
  mapControlsColumn: { position: 'absolute', right: 16, gap: 11, zIndex: 8 },
  mapControlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  mapZoomPanel: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#0b2b57',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  mapZoomButton: { width: 42, height: 41, alignItems: 'center', justifyContent: 'center' },
  mapZoomDivider: { height: 1, backgroundColor: '#e6ecf4' },
  sheetHandleZone: { paddingTop: 2, paddingBottom: 10, alignItems: 'center' },
  sheetHandle: { width: 40, height: 5, borderRadius: 999, backgroundColor: '#dce3ec' },
  sheetLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  sheetLoadingText: { color: '#20304c', fontSize: 16, fontWeight: '800' },
  modeSwitcher: { flexDirection: 'row', backgroundColor: '#eef2f7', borderRadius: 15, padding: 4, marginBottom: 12 },
  modeSegment: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 7, borderRadius: 11 },
  modeSegmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#102a43',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  modeSegmentLabel: { fontSize: 11, fontWeight: '700', color: '#8493a8', marginTop: 1 },
  modeSegmentLabelActive: { color: '#1f63c7', fontWeight: '800' },
  modeSegmentTime: { fontSize: 10, fontWeight: '700', color: '#9aa7b8' },
  modeSegmentTimeActive: { color: '#1f63c7' },
  sheetSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetModeChip: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center' },
  sheetSummaryTitle: { color: '#102a43', fontSize: 19, fontWeight: '900', lineHeight: 23 },
  sheetSummarySub: { color: '#62748b', fontSize: 13, fontWeight: '700', marginTop: 2 },
  sheetStepsScroll: { maxHeight: 250, marginTop: 12, borderTopWidth: 1, borderTopColor: '#eef1f6', paddingTop: 6 },
  sheetStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
  sheetStepIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#eef4fb', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  sheetStepText: { flex: 1, color: '#20304c', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  sheetStepDist: { color: '#8493a8', fontSize: 12, fontWeight: '800', marginTop: 2 },
  sheetStepsToggle: { color: '#1f63c7', fontSize: 13, fontWeight: '800', marginTop: 10 },
  sheetActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetGoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f63c7',
    paddingVertical: 13,
    borderRadius: 14
  },
  sheetGoButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  sheetShareButton: { width: 52, borderRadius: 14, borderWidth: 1, borderColor: '#dbe3ee', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  nativeMapEmptyTitle: { color: '#102a43', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  nativeMapEmptyText: { color: '#62748b', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 6, paddingHorizontal: 18 },
  nativeMapPopup: { position: 'absolute', left: 12, right: 12, bottom: 12, minHeight: 58, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#102a43', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  nativeMapPopupTitle: { color: '#102a43', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  nativeMapPopupText: { color: '#62748b', fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  nativeMapPopupButton: { minHeight: 36, borderRadius: 12, backgroundColor: '#1f63c7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  nativeMapPopupButtonText: { color: '#ffffff', fontSize: 11, lineHeight: 14, fontWeight: '900' },

  categoryContent: { flex: 1, backgroundColor: '#ffffff' },
  categoryContentInner: { paddingHorizontal: 14, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 14 : 16, paddingBottom: 92, gap: 10, backgroundColor: '#ffffff' },
  categoryToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  categoryToolbarTitle: { flex: 1, color: '#102a43', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  categoryBackButton: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#d8e0ea', shadowColor: '#2b405f', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 },
  categoryBackGlyph: { color: '#1f63c7', fontSize: 34, lineHeight: 36, fontWeight: '500', marginTop: -2 },
  categoryFilterIcon: { color: '#1f63c7', fontSize: 19, lineHeight: 22, fontWeight: '900' },
  filterBadge: { position: 'absolute', right: -4, top: -4, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', paddingHorizontal: 4 },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  restaurantListNative: { gap: 0 },

  bulletinContentInner: { paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_INSET + 18 : 18 },
  bulletinToolbar: { alignItems: 'center' },
  bulletinSearchBar: { flex: 1, minHeight: 42, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(214, 223, 235, 0.94)', backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  bulletinSearchIcon: { color: '#62748b', fontSize: 16, fontWeight: '900' },
  bulletinSearchInput: { flex: 1, minHeight: 40, color: '#102a43', fontSize: 13, fontWeight: '700', padding: 0 },
  bulletinClearButton: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf3fb' },
  bulletinClearText: { color: '#50627a', fontSize: 20, lineHeight: 22, fontWeight: '800' },
  bulletinPostButton: { minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', marginTop: 2 },
  bulletinPostText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  myBulletinsBlock: { gap: 8, padding: 12, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8e0ea' },
  myBulletinsTitle: { color: '#102a43', fontSize: 15, fontWeight: '900' },
  myBulletinCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#edf3fb' },
  myBulletinTitle: { color: '#102a43', fontSize: 14, fontWeight: '800' },
  myBulletinStatus: { color: '#62748b', fontSize: 12, fontWeight: '800', marginTop: 2 },
  myBulletinNote: { color: '#8f1d1d', fontSize: 12, lineHeight: 16, marginTop: 4 },
  myBulletinDeleteButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#ffd1d1' },
  myBulletinDeleteText: { color: '#8f1d1d', fontSize: 12, fontWeight: '900' },
  bulletinMosaic: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  bulletinMosaicCard: { width: '48.8%', minHeight: 92, overflow: 'hidden', borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e9f2', padding: 12, justifyContent: 'space-between' },
  bulletinMosaicCardActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  bulletinMosaicOrb: { position: 'absolute', right: -16, top: -18, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(31, 99, 199, 0.10)' },
  bulletinMosaicText: { color: '#102a43', fontSize: 15, lineHeight: 18, fontWeight: '900', marginTop: 44 },
  bulletinMosaicTextActive: { color: '#ffffff' },
  bulletinQuickRow: { gap: 8, paddingVertical: 2 },
  bulletinQuickButton: { minHeight: 34, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: '#d8e0ea', backgroundColor: '#ffffff', justifyContent: 'center' },
  bulletinQuickButtonActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  bulletinQuickText: { color: '#52667f', fontSize: 12, fontWeight: '900' },
  bulletinQuickTextActive: { color: '#ffffff' },
  bulletinFeedHead: { paddingTop: 4, paddingBottom: 2 },
  bulletinFeedTitle: { color: '#102a43', fontSize: 20, lineHeight: 24, fontWeight: '900' },
  bulletinPostSheet: { maxHeight: '82%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff' },
  bulletinPostSheetContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 18 + ANDROID_NAVIGATION_BAR_INSET, gap: 10 },
  bulletinPostInput: { minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: '#d8e0ea', backgroundColor: '#ffffff', paddingHorizontal: 13, color: '#102a43', fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  bulletinPostInputMultiline: { minHeight: 104, paddingTop: 12, paddingBottom: 12 },
  bulletinPhotoHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bulletinPhotoTitle: { color: '#102a43', fontSize: 15, fontWeight: '900' },
  bulletinAddPhotoButton: { minHeight: 34, borderRadius: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  bulletinAddPhotoText: { color: '#1f63c7', fontSize: 12, fontWeight: '900' },
  bulletinPhotoRow: { gap: 8, paddingRight: 6 },
  bulletinPhotoThumbWrap: { width: 84, height: 84, borderRadius: 16, overflow: 'hidden', backgroundColor: '#dce8f4' },
  bulletinPhotoThumb: { width: '100%', height: '100%' },
  bulletinRemovePhotoButton: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9, 19, 38, 0.70)' },
  bulletinRemovePhotoText: { color: '#ffffff', fontSize: 18, lineHeight: 20, fontWeight: '900' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  modalBackdropTouch: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1 },
  filterSheet: { maxHeight: '74%', paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff', gap: 14 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSheetTitle: { color: '#102a43', fontSize: 22, fontWeight: '900' },
  filterSheetMeta: { color: '#6c7b90', fontSize: 12, fontWeight: '800', marginTop: 3 },
  filterCloseButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterCloseText: { color: '#102a43', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  filterGroupLabel: { color: '#62748b', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  filterChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterChipActive: { backgroundColor: '#1f63c7', borderColor: '#1f63c7' },
  filterChipText: { color: '#4e6078', fontSize: 12, fontWeight: '900' },
  filterChipTextActive: { color: '#ffffff' },
  filterSheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  filterResetButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  filterResetText: { color: '#51647d', fontSize: 14, fontWeight: '900' },
  filterApplyButton: { flex: 1.2, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  filterApplyText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },

  routesIntroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 20, paddingVertical: 18 },
  routesIntroEyebrow: { color: '#ffffff', opacity: 0.82, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  routesIntroTitle: { color: '#ffffff', fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 8 },
  routesIntroText: { color: '#edf5ff', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 8 },
  routesList: { gap: 0, backgroundColor: '#ffffff' },
  routeListRow: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  routeListIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  routeListIconText: { color: '#1f63c7', fontSize: 24, lineHeight: 28, fontWeight: '900' },
  routeListTitle: { color: '#102a43', fontSize: 15.5, lineHeight: 19, fontWeight: '900' },
  routeListSubtitle: { color: '#62748b', fontSize: 12.5, lineHeight: 17, fontWeight: '600', marginTop: 4 },
  routeMetaRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  routeMetaPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: '#eef4fb', color: '#1f63c7', fontSize: 10.5, fontWeight: '900' },
  routeChevron: { color: '#9aaabd', fontSize: 28, lineHeight: 30, fontWeight: '500' },
  routeDetailHero: { borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 20, paddingVertical: 18 },
  routeDetailEyebrow: { color: '#edf5ff', opacity: 0.85, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  routeDetailTitle: { color: '#ffffff', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 8 },
  routeDetailText: { color: '#edf5ff', fontSize: 13.5, lineHeight: 20, fontWeight: '700', marginTop: 10 },
  routeDetailBlock: { paddingVertical: 4, gap: 9 },
  routeBlockTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  routeSeeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routeSeeDot: { color: '#1f63c7', fontSize: 18, lineHeight: 20, fontWeight: '900' },
  routeSeeText: { flex: 1, color: '#62748b', fontSize: 13.5, lineHeight: 20, fontWeight: '700' },
  routePointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(214, 223, 235, 0.92)' },
  routePointIndex: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7' },
  routePointIndexText: { color: '#ffffff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  routePointTitle: { color: '#102a43', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  routePointText: { color: '#62748b', fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  routeMapCard: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', padding: 14, gap: 12 },
  routeMapButton: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', paddingHorizontal: 12 },
  routeMapButtonText: { color: '#ffffff', fontSize: 13, lineHeight: 17, fontWeight: '900', textAlign: 'center' },

  programsHeroCard: { position: 'relative', overflow: 'hidden', borderRadius: 24, backgroundColor: '#1f63c7', paddingHorizontal: 22, paddingVertical: 20, alignItems: 'center' },
  programsList: { gap: 10 },
  programCard: { padding: 16, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f2', shadowColor: '#293d5d', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  programCardStay: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(31, 99, 199, 0.10)', color: '#1f63c7', fontSize: 11, fontWeight: '900' },
  programCardTitle: { color: '#102a43', fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 10 },
  programCardText: { color: '#607086', fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 6 },
  programCardAction: { color: '#1f63c7', fontSize: 13, fontWeight: '900', marginTop: 12 },

  authModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 19, 38, 0.36)' },
  authSheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#ffffff' },
  authSheetContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 18 + ANDROID_NAVIGATION_BAR_INSET, gap: 10 },
  authSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 4 },
  authSheetTitle: { color: '#102a43', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  authSheetText: { color: '#5e7088', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 5, maxWidth: 270 },
  authCloseButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  authCloseText: { color: '#102a43', fontSize: 24, lineHeight: 26, fontWeight: '700' },
  authNotice: { padding: 12, borderRadius: 16, backgroundColor: '#fff8e7', borderWidth: 1, borderColor: '#f0dfb8' },
  authNoticeText: { color: '#80611c', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  authProviderButton: { minHeight: 62, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea' },
  authProviderButtonDisabled: { opacity: 0.48 },
  authProviderBrand: { width: 38, height: 38, borderRadius: 14, overflow: 'hidden', backgroundColor: '#eaf3ff', color: '#1f63c7', textAlign: 'center', textAlignVertical: 'center', fontSize: 17, lineHeight: 38, fontWeight: '900' },
  authProviderTitle: { color: '#102a43', fontSize: 14.5, lineHeight: 18, fontWeight: '900' },
  authProviderSub: { color: '#62748b', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  authLegalText: { color: '#62748b', fontSize: 11.5, lineHeight: 17, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
  authLegalTextLink: { color: '#1f63c7', fontWeight: '900', textDecorationLine: 'underline' },
  authLegalLinks: { paddingHorizontal: 4, gap: 8 },
  authLegalLinkText: { color: '#1f63c7', fontSize: 12.5, lineHeight: 17, fontWeight: '900', textDecorationLine: 'underline' },
  profileBlock: { minHeight: 76, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  profileAvatar: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f63c7', overflow: 'hidden' },
  profileAvatarImage: { width: 46, height: 46 },
  profileAvatarText: { color: '#ffffff', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  profileName: { color: '#102a43', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  profileEmail: { color: '#62748b', fontSize: 11.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  profileLogoutButton: { minHeight: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5fa', paddingHorizontal: 12 },
  profileLogoutText: { color: '#1f63c7', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  profileNotificationRow: { minHeight: 82, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d8e0ea', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  profileNotificationTitle: { color: '#102a43', fontSize: 14, lineHeight: 18, fontWeight: '900' },
  profileNotificationText: { color: '#62748b', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  profileNotificationSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#d8e0ea', padding: 3, justifyContent: 'center' },
  profileNotificationSwitchActive: { backgroundColor: '#1f63c7' },
  profileNotificationKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff' },
  profileNotificationKnobActive: { transform: [{ translateX: 20 }] },
  profileDeleteButton: { minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff1f1', borderWidth: 1, borderColor: '#ffd1d1', paddingHorizontal: 12 },
  profileDeleteText: { color: '#8f1d1d', fontSize: 12.5, lineHeight: 16, fontWeight: '900' },

  bottomTabs: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 0, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 16 : 8 + ANDROID_NAVIGATION_BAR_INSET, backgroundColor: 'rgba(250,252,255,0.97)', borderTopWidth: 1, borderTopColor: 'rgba(211, 221, 234, 0.92)', shadowColor: '#293d5d', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.10, shadowRadius: 24, elevation: 14 },
  bottomTabsInner: { minHeight: 60, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderRadius: 0, backgroundColor: 'transparent', borderWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowOpacity: 0, elevation: 0 },
  tabButton: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 18 },
  tabIconWrap: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(215, 224, 237, 0.62)' },
  activeTabIconWrap: { backgroundColor: '#1f63c7' },
  tabIconText: { color: '#8d9bad', fontSize: 16, fontWeight: '900' },
  activeTabIconText: { color: '#ffffff' },
  tabText: { color: '#62748b', fontWeight: '800', fontSize: 10.5, lineHeight: 12, marginTop: 0 },
  activeTabText: { color: '#1f63c7' }
};
import type { ThemeTokens } from './tokens';

export function retheme(t: any) {
  const next: any = {};
  Object.keys(styles).forEach((key) => {
    next[key] = { ...styles[key] };
  });

  next.safeArea.backgroundColor = t.page;
  next.content.backgroundColor = t.page;
  next.contentInner.backgroundColor = t.page;
  next.homeContentInner.backgroundColor = t.page;
  next.homeRoot.backgroundColor = t.page;
  next.homeBody.backgroundColor = t.page;
  next.appHeader.backgroundColor = t.page;
  next.appHeader.borderBottomColor = t.hair;
  next.logoText.color = t.acc;
  next.headerBackButton.backgroundColor = t.card;
  next.headerBackButton.borderColor = t.hair;
  next.headerBackText.color = t.fg;
  next.quickLabel.color = t.fg;
  next.homeSectionTitle.color = t.fg;
  next.homeSectionLink.color = t.acc;
  next.tipRow.borderBottomColor = t.hair;
  next.tipThumbPlaceholder.backgroundColor = t.hair;
  next.tipThumbGlyph.color = t.acc;
  next.tipTitle.color = t.fg;
  next.tipText.color = t.dim;
  next.tipChevron.color = t.dim;
  next.screenTitle.color = t.fg;
  next.screenText.color = t.dim;
  next.sectionTitle.color = t.fg;
  next.searchInput.backgroundColor = t.card;
  next.searchInput.borderColor = t.hair;
  next.searchInput.color = t.fg;
  next.listRow.backgroundColor = t.page;
  next.listRowTitle.color = t.fg;
  next.listRowFactText.color = t.dim;
  next.bottomTabs.backgroundColor = t.nav;
  next.bottomTabs.borderTopColor = t.hair;
  next.tabIconWrap.backgroundColor = t.hair;
  next.activeTabIconWrap.backgroundColor = t.acc;
  next.tabIconText.color = t.dim;
  next.activeTabIconText.color = '#ffffff';
  next.tabText.color = t.dim;
  next.activeTabText.color = t.acc;
    next.quickItem = { ...next.quickItem, position: 'relative' };
  next.quickIconGlow = { shadowColor: t.acc, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 4 };
  next.goldBlob = { position: 'absolute', top: -12, right: -6, width: 52, height: 42, borderRadius: 26, backgroundColor: 'rgba(240, 163, 92, 0.32)' };
  next.tipTitleDisplay = { fontSize: 16, lineHeight: 20, letterSpacing: -0.2 };
  next.programTimeline = { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, width: '100%' };
  next.programTimelineLine = { flex: 1, height: 2, backgroundColor: 'rgba(255, 255, 255, 0.35)', marginHorizontal: 8 };
  next.programTimelineNode = { alignItems: 'center', gap: 4 };
  next.programTimelineDot = { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffffff', borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.55)' };
  next.programTimelineLabel = { color: '#ffffff', fontSize: 10, fontWeight: '900' };
  next.navGlowLine = { position: 'absolute', top: -1, left: 0, right: 0, height: 2, backgroundColor: t.acc, opacity: 0.55, shadowColor: t.acc, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6, elevation: 6 };
  // ── Списки мест: категория, объявления, маршруты, программы, прочее ──
  next.categoryContent.backgroundColor = t.page;
  next.categoryContentInner.backgroundColor = t.page;
  next.categoryToolbarTitle.color = t.fg;
  next.categoryBackButton.backgroundColor = t.card;
  next.categoryBackButton.borderColor = t.hair;
  next.categoryBackGlyph.color = t.acc;
  next.categoryBackPill.backgroundColor = t.card;
  next.categoryBackPill.borderColor = t.hair;
  next.categoryBackPillText.color = t.fg;
  next.categoryHeaderTitle = { ...next.categoryHeaderTitle, color: t.fg, fontStyle: 'italic' };
  next.categoryHeaderCircle.backgroundColor = t.card;
  next.categoryHeaderCircle.borderColor = t.hair;
  next.categoryFilterIcon.color = t.acc;
  next.filterBadge.backgroundColor = t.acc;
  next.cuisineChip.backgroundColor = t.card;
  next.cuisineChip.borderColor = t.hair;
  next.cuisineChipText.color = t.dim;
  next.cuisineChipActive.backgroundColor = t.acc;
  next.cuisineChipActive.borderColor = t.acc;
  next.cuisineChipTextActive.color = '#ffffff';
  next.categoryTabsRow.borderBottomColor = t.hair;
  next.categoryTabText.color = t.dim;
  next.categoryTabTextActive.color = t.fg;
  next.categoryTabActive.borderBottomColor = t.acc;
  next.categoryLocateNote.color = t.dim;
  next.listRow.backgroundColor = t.page;
  next.listRow.borderBottomColor = t.hair;
  next.listRowTitle.color = t.fg;
  next.listRowFactText.color = t.dim;
  next.listRowRating.color = t.fg;
  next.listRowImageFallback.backgroundColor = t.hair;
  next.categoryMapFloatButton.backgroundColor = t.acc;
  next.categoryMapCountChip.backgroundColor = t.card;
  next.categoryMapCountText.color = t.fg;
  next.filterSheet.backgroundColor = t.page;
  next.filterSheetTitle = { ...next.filterSheetTitle, color: t.fg, fontStyle: 'italic' };
  next.filterSheetMeta.color = t.dim;
  next.filterCloseButton.backgroundColor = t.card;
  next.filterCloseButton.borderColor = t.hair;
  next.filterCloseText.color = t.fg;
  next.filterGroupLabel.color = t.dim;
  next.filterChip.backgroundColor = t.card;
  next.filterChip.borderColor = t.hair;
  next.filterChipText.color = t.dim;
  next.filterChipActive.backgroundColor = t.acc;
  next.filterChipActive.borderColor = t.acc;
  next.filterChipTextActive.color = '#ffffff';
  next.filterResetButton.backgroundColor = t.card;
  next.filterResetButton.borderColor = t.hair;
  next.filterResetText.color = t.dim;
  next.filterApplyButton.backgroundColor = t.acc;
  next.filterApplyText.color = '#ffffff';
  next.bulletinSearchBar.backgroundColor = t.card;
  next.bulletinSearchBar.borderColor = t.hair;
  next.bulletinSearchIcon.color = t.dim;
  next.bulletinSearchInput.color = t.fg;
  next.bulletinClearButton.backgroundColor = t.hair;
  next.bulletinClearText.color = t.fg;
  next.bulletinPostButton.backgroundColor = t.acc;
  next.bulletinPostText.color = '#ffffff';
  next.myBulletinsBlock.backgroundColor = t.card;
  next.myBulletinsBlock.borderColor = t.hair;
  next.myBulletinTitle.color = t.fg;
  next.myBulletinStatus.color = t.dim;
  next.myBulletinCard.borderTopColor = t.hair;
  next.bulletinMosaicCard.backgroundColor = t.card;
  next.bulletinMosaicCard.borderColor = t.hair;
  next.bulletinMosaicText.color = t.fg;
  next.bulletinMosaicCardActive.backgroundColor = t.acc;
  next.bulletinMosaicTextActive.color = '#ffffff';
  next.bulletinFeedTitle = { ...next.bulletinFeedTitle, color: t.fg, fontStyle: 'italic' };
  next.bulletinPostSheet.backgroundColor = t.page;
  next.bulletinPostInput.backgroundColor = t.card;
  next.bulletinPostInput.borderColor = t.hair;
  next.bulletinPostInput.color = t.fg;
  next.bulletinQuickButton.backgroundColor = t.card;
  next.bulletinQuickButton.borderColor = t.hair;
  next.bulletinQuickText.color = t.dim;
  next.bulletinQuickButtonActive.backgroundColor = t.acc;
  next.bulletinQuickButtonActive.borderColor = t.acc;
  next.bulletinQuickTextActive.color = '#ffffff';
  next.bulletinAddPhotoButton.backgroundColor = t.card;
  next.bulletinAddPhotoButton.borderColor = t.hair;
  next.bulletinAddPhotoText.color = t.acc;
  next.bulletinPhotoThumbWrap.backgroundColor = t.hair;
  next.bulletinPhotoTitle.color = t.fg;
  next.routeListRow.borderBottomColor = t.hair;
  next.routeListIcon.backgroundColor = t.hair;
  next.routeListIconText.color = t.acc;
  next.routeListTitle.color = t.fg;
  next.routeListSubtitle.color = t.dim;
  next.routeMetaPill.backgroundColor = t.hair;
  next.routeMetaPill.color = t.acc;
  next.routeChevron.color = t.dim;
  next.routeBlockTitle.color = t.fg;
  next.routeSeeDot.color = t.acc;
  next.routeSeeText.color = t.dim;
  next.routePointRow.borderBottomColor = t.hair;
  next.routePointIndex.backgroundColor = t.acc;
  next.routePointTitle.color = t.fg;
  next.routePointText.color = t.dim;
  next.routeMapCard.backgroundColor = t.card;
  next.routeMapCard.borderColor = t.hair;
  next.routeMapStatusText.color = t.fg;
  next.routeMapButton.backgroundColor = t.acc;
  next.routeMapButtonText.color = '#ffffff';
  next.programCard.backgroundColor = t.card;
  next.programCard.borderColor = t.hair;
  next.programCardTitle.color = t.fg;
  next.programCardText.color = t.dim;
  next.programCardAction.color = t.acc;
  next.contactCard.backgroundColor = t.card;
  next.contactCard.borderColor = t.hair;
  next.contactCardTitle.color = t.fg;
  next.contactCardText.color = t.dim;
  next.contactValue.color = t.acc;
  next.legalLinksCard.backgroundColor = t.card;
  next.legalLinksCard.borderColor = t.hair;
  next.legalLinksTitle.color = t.fg;
  next.legalLinkText.color = t.acc;
  next.legalLinkArrow.color = t.dim;
  next.noteText.color = t.dim;
  next.screenTitle = { ...next.screenTitle, color: t.fg, fontStyle: 'italic' };
  next.screenText.color = t.dim;
  next.nativeMapEmptyTitle.color = t.fg;
  next.nativeMapEmptyText.color = t.dim;
  next.nativeMapCard.backgroundColor = t.card;
  next.nativeMapCard.borderColor = t.hair;
  next.nativeMapFlat.backgroundColor = t.card;
  next.mapFullscreenRoot.backgroundColor = t.card;
  next.mapStuckOverlay.backgroundColor = t.card;
  next.mapStuckText.color = t.fg;
  next.mapStuckButton.backgroundColor = t.acc;
  next.mapStuckButtonText.color = '#ffffff';
  next.mapFullscreenClose.backgroundColor = t.card;
  next.mapFullscreenCard.backgroundColor = t.page;
  next.detailMapFallback.backgroundColor = t.card;
  next.detailMapFallback.borderColor = t.hair;
  next.detailMapFallbackTitle.color = t.fg;
  next.detailMapFallbackText.color = t.dim;
  styles = next;
}