import ClientPage from '../components/ClientPage';
import { fetchMediaSSR } from '../utils/api';

// This component will handle server-side rendering for initial data
export default async function Home() {
  let initialData = { media: [], pages: 0 };
  
  try {
    // Server-side fetch of initial media data using our SSR-compatible utility
    initialData = await fetchMediaSSR({ 
      revalidate: 60 // Revalidate the data every 60 seconds
    });
    
    console.log('Server-side rendered data fetched successfully');
  } catch (error) {
    console.error('Server-side data fetching error:', error);
    // We'll still render the client component even if SSR fails
  }
  
  // Pass initial data to client component
  return <ClientPage initialData={initialData} />;
}
