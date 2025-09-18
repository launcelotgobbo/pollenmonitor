import Link from 'next/link';
import CityInput from '@/components/CityInput';

export default function HomePage() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p>Choose an action:</p>
      <ul>
        <li>
          <Link href="/date">Pick a date and see the pollen count</Link>
        </li>
        <li>
          <Link href="/city/new-york">Pick a city and see historical pollen count</Link>
        </li>
        <li>
          <Link href="/map">View US Pollen Map</Link>
        </li>
      </ul>
      <div>
        <h3>Quick city lookup</h3>
        <CityInput />
      </div>
    </div>
  );
}
