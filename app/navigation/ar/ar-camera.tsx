"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ArTarget = {
  name: string;
  floor: string;
  lat: number;
  lon: number;
};

type Props = {
  target: ArTarget | null;
  backHref: string;
};

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type UserLocation = {
  lat: number;
  lon: number;
  accuracy: number;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceMeters(
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
) {
  const latitudeDifference = toRadians(second.lat - first.lat);
  const longitudeDifference = toRadians(second.lon - first.lon);
  const arc =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 6371000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function getBearingDegrees(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
) {
  const originLatitude = toRadians(origin.lat);
  const destinationLatitude = toRadians(destination.lat);
  const longitudeDifference = toRadians(destination.lon - origin.lon);
  const y = Math.sin(longitudeDifference) * Math.cos(destinationLatitude);
  const x =
    Math.cos(originLatitude) * Math.sin(destinationLatitude) -
    Math.sin(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.cos(longitudeDifference);

  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function getRelativeBearing(targetBearing: number, heading: number) {
  return ((targetBearing - heading + 540) % 360) - 180;
}

export default function ArCamera({ target, backHref }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [heading, setHeading] = useState(0);
  const [hasLiveHeading, setHasLiveHeading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [sensorMessage, setSensorMessage] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraStream || !video) return;

    video.srcObject = cameraStream;
    return () => cameraStream.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  useEffect(() => {
    if (!cameraStream) return;

    function handleOrientation(event: DeviceOrientationEvent) {
      const compassEvent = event as CompassEvent;
      const sensorHeading = compassEvent.webkitCompassHeading ??
        (event.alpha === null ? null : normalizeDegrees(360 - event.alpha));

      if (sensorHeading === null || !Number.isFinite(sensorHeading)) return;

      setHeading(normalizeDegrees(sensorHeading));
      setHasLiveHeading(true);
    }

    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, [cameraStream]);

  async function startCamera() {
    if (!userLocation) return;
    setIsStarting(true);
    setCameraError("");
    setSensorMessage("");

    try {
      const orientationConstructor = window.DeviceOrientationEvent as
        | OrientationConstructor
        | undefined;

      if (orientationConstructor?.requestPermission) {
        try {
          const permission = await orientationConstructor.requestPermission();
          if (permission !== "granted") {
            setSensorMessage("Compass permission was not granted. Use the heading slider to test the arrow.");
          }
        } catch {
          setSensorMessage("Compass access is unavailable. Use the heading slider to test the arrow.");
        }
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access requires a supported browser over HTTPS or localhost.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });

      setCameraStream(stream);
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : "Camera access could not be started.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setHasLiveHeading(false);
  }

  function getCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is unavailable in this browser. Try using HTTPS on a supported phone.");
      return;
    }

    setIsLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({
          lat: coords.latitude,
          lon: coords.longitude,
          accuracy: coords.accuracy,
        });
        setIsLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Allow location access and try again."
            : error.code === error.TIMEOUT
              ? "Location took too long. Try again outdoors or near an open area."
              : "Could not determine your location. Check device location services and retry.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }

  const targetBearing = target && userLocation
    ? getBearingDegrees(userLocation, target)
    : null;
  const relativeBearing = targetBearing === null
    ? 0
    : getRelativeBearing(targetBearing, heading);
  const distanceMeters = target && userLocation
    ? Math.round(getDistanceMeters(userLocation, target))
    : null;

  return (
    <main className="finder-page ar-page">
      <header className="finder-header">
        <Link className="finder-brand" href="/" aria-label="Arah home">
          <span className="finder-brand-mark" aria-hidden="true">a</span>
          <span>arah</span>
        </Link>
        <span className="finder-header-label">AR direction test</span>
        <Link className="finder-back" href={backHref}>Back to shops <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="ar-intro" aria-labelledby="ar-title">
        <p className="eyebrow">CAMERA COMPASS / TEST MODE</p>
        <h1 id="ar-title">{target?.name ?? "Choose a shop"}</h1>
        <p>
          {target
            ? `${target.floor}${distanceMeters === null ? " · Set your location to begin" : ` · ${distanceMeters} m away`}`
            : "Shop coordinates are missing."}
        </p>
      </section>

      <section className="ar-workspace" aria-label="Camera direction test">
        <div className="ar-camera-view">
          {cameraStream ? (
            <video ref={videoRef} className="ar-camera-video" autoPlay playsInline muted />
          ) : (
            <div className="ar-camera-placeholder">
              <span className="ar-placeholder-mark" aria-hidden="true">+</span>
              <p>Camera preview</p>
              <span>Start the camera to place the direction arrow over a live view.</span>
            </div>
          )}
          <div className="ar-camera-shade" />
          {target && userLocation && targetBearing !== null && (
            <div
              className="ar-direction-arrow"
              style={{ transform: `translate(-50%, -50%) rotate(${relativeBearing}deg)` }}
              aria-label={`Direction to ${target.name}: ${Math.round(normalizeDegrees(targetBearing - heading))} degrees from phone heading`}
            >
              ↑
            </div>
          )}
          <div className="ar-camera-tag">{cameraStream ? "LIVE CAMERA" : "SIMULATED CAMERA VIEW"}</div>
          <div className="ar-camera-distance">
            {distanceMeters === null ? "Set location" : `${distanceMeters} m`}
          </div>
        </div>

        <aside className="ar-controls">
          <div className="ar-destination">
            <p className="eyebrow">DESTINATION</p>
            <h2>{target?.name ?? "Padini Concept Store"}</h2>
            <p>{target?.floor ?? "Ground Floor"}</p>
            {target && (
              <a
                href={`https://www.google.com/maps?q=${target.lat},${target.lon}`}
                target="_blank"
                rel="noreferrer"
              >
                Test pin in Google Maps <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>

          <div className="ar-origin">
            <p className="eyebrow">YOUR LOCATION</p>
            {userLocation ? (
              <>
                <p>{userLocation.lat.toFixed(6)}, {userLocation.lon.toFixed(6)}</p>
                <p className="ar-location-accuracy">GPS accuracy ±{Math.round(userLocation.accuracy)} m</p>
              </>
            ) : (
              <p>Location not set</p>
            )}
            <button
              className="ar-location-button"
              type="button"
              onClick={getCurrentLocation}
              disabled={isLocating}
            >
              <span aria-hidden="true">◎</span>
              {isLocating ? "Getting location..." : userLocation ? "Refresh location" : "Use my current location"}
            </button>
            {locationError && <p className="ar-error" role="alert">{locationError}</p>}
          </div>

          <div className="ar-heading-control">
            <label htmlFor="phone-heading">
              <span>{hasLiveHeading ? "Live phone heading" : "Simulated phone heading"}</span>
              <span>{Math.round(heading)}°</span>
            </label>
            <input
              id="phone-heading"
              type="range"
              min="0"
              max="359"
              step="1"
              value={Math.round(heading)}
              disabled={!userLocation || hasLiveHeading}
              onChange={(event) => setHeading(Number(event.target.value))}
            />
            <p>
              {sensorMessage || (userLocation
                ? "Move the slider to simulate turning the phone; the arrow points toward the selected shop."
                : "Set your current location before testing the direction arrow.")}
            </p>
          </div>

          {cameraError && <p className="ar-error" role="alert">{cameraError}</p>}

          <button
            className="ar-camera-button"
            type="button"
            onClick={cameraStream ? stopCamera : startCamera}
            disabled={isStarting || !target || !userLocation}
          >
            {isStarting ? "Starting camera..." : cameraStream ? "Stop camera" : "Start AR camera"}
          </button>

          <p className="ar-test-note">
            GPS and compass can drift indoors. This arrow is a straight-line guide, not an indoor walking route.
          </p>
        </aside>
      </section>
    </main>
  );
}