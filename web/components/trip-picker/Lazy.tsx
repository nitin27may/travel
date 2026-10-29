'use client';

// The lazy doors to the trip picker and the "In your trips" line: the page's start code holds only these two stubs; each chunk loads on use.
import dynamic from 'next/dynamic';

export const TripPickerLazy = dynamic(() => import('./TripPicker').then((m) => m.TripPicker), { ssr: false });
export const InYourTripsLazy = dynamic(() => import('./InYourTrips').then((m) => m.InYourTrips), { ssr: false });
