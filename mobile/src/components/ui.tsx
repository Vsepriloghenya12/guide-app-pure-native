import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { GuideCategory, GuidePlace } from '../types';
import { API_BASE_URL } from '../api/client';
import { normalizeImageUrl } from '../utils/normalizers';
import { categoryIcons, defaultCategoryIcon } from '../assets';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
};

export function AppButton({ label, onPress, variant = 'primary' }: ButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.button, variant === 'ghost' && styles.ghostButton, variant === 'danger' && styles.dangerButton]}
    >
      <Text style={[styles.buttonText, variant === 'ghost' && styles.ghostButtonText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Pill({ label }: { label: string }) {
  if (!label) return null;
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" />
      <Text style={styles.loadingText}>Загружаем гид</Text>
    </View>
  );
}

export function CategoryCard({ category, count, onPress }: { category: GuideCategory; count: number; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.categoryCard}>
      <Image source={categoryIcons[category.id] || defaultCategoryIcon} style={styles.categoryIconImage} />
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{category.title}</Text>
        <Text style={styles.cardText} numberOfLines={2}>{category.description || `${count} мест в разделе`}</Text>
      </View>
      <Text style={styles.countText}>{count}</Text>
    </TouchableOpacity>
  );
}

export function ListingCard({
  place,
  isFavorite,
  onPress,
  onToggleFavorite
}: {
  place: GuidePlace;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const { width } = useWindowDimensions();
  const [fullscreenImage, setFullscreenImage] = useState('');
  const imageWidth = Math.max(280, width - 28);
  const imageUrls = [
    place.coverImageUrl,
    place.imageSrc,
    ...(Array.isArray(place.imageGallery) ? place.imageGallery : []),
    ...(Array.isArray(place.imageUrls) ? place.imageUrls : [])
  ]
    .map((item) => normalizeImageUrl(item, API_BASE_URL))
    .filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.listingCard}>
      {imageUrls.length > 0 ? (
        <View style={styles.listingImageWrap}>
          <ScrollView horizontal pagingEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false} style={styles.listingImage}>
            {imageUrls.map((imageUrl, index) => (
              <TouchableOpacity key={`${imageUrl}-${index}`} activeOpacity={0.92} onPress={() => setFullscreenImage(imageUrl)}>
                <Image source={{ uri: imageUrl }} style={[styles.listingImageSlide, { width: imageWidth }]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {imageUrls.length > 1 ? <Text style={styles.listingImageCount}>{imageUrls.length} фото</Text> : null}
        </View>
      ) : <View style={[styles.listingImage, styles.imageFallback]} />}
      <View style={styles.listingBody}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle} numberOfLines={2}>{place.title}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>{place.district || place.kind || place.listingType || place.categoryId}</Text>
          </View>
          <TouchableOpacity activeOpacity={0.78} onPress={onToggleFavorite} style={styles.favoriteButton}>
            <Text style={styles.favoriteText}>{isFavorite ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.cardText} numberOfLines={2}>{place.shortDescription || place.description}</Text>
        <View style={styles.pillsRow}>
          <Pill label={place.priceLabel || ''} />
          <Pill label={place.cuisine || ''} />
          {place.top ? <Pill label="Топ" /> : null}
        </View>
      </View>
      <FullscreenImageModal imageUrl={fullscreenImage} onClose={() => setFullscreenImage('')} />
    </TouchableOpacity>
  );
}

function FullscreenImageModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <Modal visible={Boolean(imageUrl)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fullscreenImageBackdrop}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.fullscreenImageCloseArea}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.fullscreenImage} resizeMode="contain" /> : null}
          <View style={styles.fullscreenImageCloseButton}>
            <Text style={styles.fullscreenImageCloseText}>×</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#2567c2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  ghostButton: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dfe7f1' },
  dangerButton: { backgroundColor: '#8f1d1d' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostButtonText: { color: '#102a43' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eef4fb' },
  pillText: { color: '#315f98', fontSize: 12, fontWeight: '700' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  emptyState: { padding: 22, borderRadius: 24, backgroundColor: '#fff8ef', borderWidth: 1, borderColor: '#ead9c2', gap: 8 },
  emptyTitle: { color: '#102a43', fontSize: 20, fontWeight: '800' },
  emptyText: { color: '#627d98', fontSize: 15, lineHeight: 21 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f5f7fb' },
  loadingText: { color: '#486581', fontSize: 16, fontWeight: '700' },
  categoryCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe7f1' },
  categoryIconImage: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#e3edf6' },
  cardTitle: { color: '#102a43', fontSize: 18, fontWeight: '800' },
  cardText: { color: '#62748b', fontSize: 14, lineHeight: 20, marginTop: 5 },
  cardMeta: { color: '#53739b', fontSize: 13, marginTop: 4, fontWeight: '700' },
  countText: { color: '#53739b', fontSize: 14, fontWeight: '800' },
  listingCard: { borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe7f1', overflow: 'hidden' },
  listingImageWrap: { width: '100%', height: 170, backgroundColor: '#e3f0ec' },
  listingImage: { width: '100%', height: 170, backgroundColor: '#e3f0ec' },
  listingImageSlide: { width: 360, height: 170, backgroundColor: '#e3f0ec' },
  listingImageCount: { position: 'absolute', right: 10, bottom: 10, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(9, 19, 38, 0.62)', color: '#ffffff', fontSize: 11, fontWeight: '900' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  fullscreenImageBackdrop: { flex: 1, backgroundColor: 'rgba(2, 8, 23, 0.94)' },
  fullscreenImageCloseArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  fullscreenImage: { width: '100%', height: '86%' },
  fullscreenImageCloseButton: { position: 'absolute', top: 44, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImageCloseText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '600' },
  listingBody: { padding: 16 },
  favoriteButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#f1f5fa', alignItems: 'center', justifyContent: 'center' },
  favoriteText: { color: '#2f78d6', fontSize: 24, lineHeight: 26 }
});

export const uiStyles = styles;
