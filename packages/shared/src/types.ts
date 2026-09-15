// Mirrors supabase/migrations/0001_init.sql — keep both in sync by hand until we
// switch to `supabase gen types typescript`.

export type UserStatus = 'active' | 'suspended';
export type DriverStatus = 'pending' | 'active' | 'suspended';
export type RideStatus = 'searching' | 'dispatched' | 'toPickup' | 'arrived' | 'onTrip' | 'done' | 'cancelled';
export type MessageAudience = 'all' | 'users' | 'drivers' | 'one';
export type AdAudience = 'all' | 'users' | 'drivers';
export type CurrencyCode = 'SYP' | 'TRY' | 'USD';

export interface Rider {
  id: string;
  name: string;
  phone: string;
  email: string;
  username: string;
  photoUrl: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  username: string;
  plate: string;
  car: string;
  selfieUrl: string | null;
  carPhotoUrl: string | null;
  status: DriverStatus;
  online: boolean;
  lat: number | null;
  lng: number | null;
  acceptedCount: number;
  rejectedCount: number;
  updatedAt: string;
}

export interface Place {
  id: string;
  name: string;
  area: string;
  kind: string | null;
  lat: number;
  lng: number;
  source: 'manual' | 'osm';
  createdAt: string;
}

export interface Ride {
  id: string;
  riderId: string;
  driverId: string | null;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  destName: string;
  destLat: number;
  destLng: number;
  status: RideStatus;
  km: number | null;
  minutes: number | null;
  fareAmount: number | null;
  fareCurrency: CurrencyCode | null;
  waitSeconds: number;
  waitRuns: number;
  waitFare: number;
  etaMinutes: number | null;
  declinedDriverIds: string[];
  requestedAt: string;
  dispatchedAt: string | null;
  matchedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface Rating {
  id: string;
  rideId: string;
  driverId: string;
  riderId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  editedByAdmin: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  title: string;
  body: string;
  audience: MessageAudience;
  targetKind: 'user' | 'driver' | null;
  targetId: string | null;
  createdAt: string;
}

export interface Ad {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  audience: AdAudience;
  buttonLabel: string | null;
  buttonUrl: string | null;
  imageFit: 'cover' | 'contain';
  height: number;
  active: boolean;
  createdAt: string;
}

export interface PricingRow {
  currency: CurrencyCode;
  base: number;
  perKm: number;
  perMin: number;
  minFare: number;
  roundTo: number;
  perWaitHour: number;
}

export interface PricingSettings {
  activeCurrency: CurrencyCode;
  showToRiders: boolean;
}

export interface AdminSettings {
  adminUsername: string;
}
