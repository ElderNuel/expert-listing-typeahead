import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Expert Listing Typeahead',
  description: 'Production-ready, accessible WAI-ARIA 1.2 Typeahead component querying geocoding data with race condition protection and 300ms debounce.',
  openGraph: {
    title: 'Expert Listing Typeahead',
    description: 'Production-ready, accessible WAI-ARIA 1.2 Typeahead component querying geocoding data with race condition protection and 300ms debounce.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Expert Listing Typeahead',
    description: 'Production-ready, accessible WAI-ARIA 1.2 Typeahead component querying geocoding data with race condition protection and 300ms debounce.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
