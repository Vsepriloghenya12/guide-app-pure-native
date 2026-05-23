import { CategoryExplorer } from '../components/listing/CategoryExplorer';
import type { GuideCategoryId } from '../types';

type ListingPageProps = {
  category: GuideCategoryId;
};

export function ListingPage({ category }: ListingPageProps) {
  return <CategoryExplorer categoryId={category} />;
}
