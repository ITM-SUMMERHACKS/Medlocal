import { useEffect, useState } from "react";
import { DEFAULT_LOCATION } from "@/lib/distance";

export function useGeolocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(DEFAULT_LOCATION);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGranted(true);
      },
      () => {
        setCoords(DEFAULT_LOCATION);
        setGranted(false);
      },
      { timeout: 5000 },
    );
  }, []);

  return { coords, granted };
}
