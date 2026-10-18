'use client';

import { createContext } from 'react';
import type { MapFamily } from '@/lib/map/types';

export const FamilyContext = createContext<MapFamily | null>(null);
