import { useParams } from 'react-router-dom';
import { BulletinBoardExplorer } from '../components/listing/BulletinBoardExplorer';
import { CategoryExplorer } from '../components/listing/CategoryExplorer';

export function CategoryPlaceholderPage() {
  const { slug = '' } = useParams();

  if (slug === 'bulletin-board') {
    return <BulletinBoardExplorer />;
  }

  return <CategoryExplorer categorySlug={slug} />;
}
