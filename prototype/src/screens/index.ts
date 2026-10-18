// Screen registry. Each screen file exports one component taking ScreenProps; Plan lives in src/plan.
import type { ComponentType } from "react";
import type { Place } from "../data/places";
import { Admin } from "./Admin";
import { Bookings } from "./Bookings";
import { Budget } from "./Budget";
import { Explore } from "./Explore";
import { Home } from "./Home";
import { NewTrip } from "./NewTrip";
import { PlacePage } from "./PlacePage";
import { Settings } from "./Settings";
import { Guest, Share } from "./Share";
import { Tasks } from "./Tasks";
import { Templates } from "./Templates";
import { Today } from "./Today";

export type ScreenId = "home" | "plan" | "today" | "bookings" | "tasks" | "budget" | "explore" | "place" | "templates" | "admin" | "settings" | "share" | "guest" | "new";
export interface ScreenProps { phone: boolean; theme: "light" | "dark"; go: (id: ScreenId, tripId?: string) => void; place?: Place; tripId?: string }

const Nothing = () => null;
export const SCREENS: Record<ScreenId, ComponentType<ScreenProps>> = {
  home: Home, plan: Nothing, today: Today, bookings: Bookings, tasks: Tasks, budget: Budget, explore: Explore, place: PlacePage,
  templates: Templates, admin: Admin, settings: Settings, share: Share, guest: Guest, new: NewTrip,
};
