"use client";

import { createContext, useContext } from "react";
import type { CampoId } from "./campos";

interface UserContextValue {
  isAdmin: boolean;
  displayName: string;
  campo: CampoId | null;
  profileLoaded: boolean;
}

export const UserContext = createContext<UserContextValue>({ isAdmin: false, displayName: "", campo: null, profileLoaded: false });

export function useUserRole() {
  return useContext(UserContext);
}
