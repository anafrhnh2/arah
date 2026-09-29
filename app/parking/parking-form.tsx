"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";

type ParkingRecord = {
  place: string;
  level: string;
  block: string;
  bay: string;
  photo: string | null;
  coordinates: { lat: number; lon: number; accuracy: number } | null;
  savedAt: string;
};

const PARKING_STORAGE_KEY = "arah:saved-parking";
const parkingSubscribers = new Set<() => void>();

function subscribeToParking(callback: () => void) {
  parkingSubscribers.add(callback);
  window.addEventListener("storage", callback);

  return () => {
    parkingSubscribers.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getParkingSnapshot() {
  return window.localStorage.getItem(PARKING_STORAGE_KEY);
}

function getServerParkingSnapshot() {
  return null;
}

function parseParkingRecord(serialized: string | null): ParkingRecord | null {
  if (!serialized) return null;

  try {
    const value = JSON.parse(serialized) as Partial<ParkingRecord>;
    if (
      typeof value.place !== "string" ||
      typeof value.level !== "string" ||
      typeof value.block !== "string" ||
      typeof value.bay !== "string" ||
      typeof value.savedAt !== "string"
    ) {
      return null;
    }

    const savedCoordinates = value.coordinates;
    const coordinates =
      savedCoordinates &&
      Number.isFinite(savedCoordinates.lat) &&
      Number.isFinite(savedCoordinates.lon) &&
      Number.isFinite(savedCoordinates.accuracy)
        ? savedCoordinates
        : null;

    return {
      place: value.place,
      level: value.level,
      block: value.block,
      bay: value.bay,
      photo: typeof value.photo === "string" ? value.photo : null,
      coordinates,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}

function notifyParkingSubscribers() {
  parkingSubscribers.forEach((subscriber) => subscriber());
}

function compressPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That photo could not be opened."));
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Photo preview is not available in this browser."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

export default function ParkingForm() {
  const [place, setPlace] = useState("");
  const [level, setLevel] = useState("");
  const [block, setBlock] = useState("");
  const [bay, setBay] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<ParkingRecord["coordinates"]>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [message, setMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const savedParkingJson = useSyncExternalStore(
    subscribeToParking,
    getParkingSnapshot,
    getServerParkingSnapshot,
  );
  const savedRecord = parseParkingRecord(savedParkingJson);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image to save with your parking spot.");
      return;
    }

    try {
      setPhoto(await compressPhoto(file));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save that photo.");
    }
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setMessage("Location is unavailable in this browser. You can still save the level and block.");
      return;
    }

    setIsLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords: currentCoordinates }) => {
        setCoordinates({
          lat: currentCoordinates.latitude,
          lon: currentCoordinates.longitude,
          accuracy: currentCoordinates.accuracy,
        });
        setIsLocating(false);
      },
      () => {
        setMessage("Could not get GPS location. You can still save the level and block.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const record: ParkingRecord = {
      place: place.trim(),
      level: level.trim(),
      block: block.trim(),
      bay: bay.trim(),
      photo,
      coordinates,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(PARKING_STORAGE_KEY, JSON.stringify(record));
      notifyParkingSubscribers();
      setIsEditing(false);
      setMessage("");
    } catch {
      setMessage("Could not save parking on this device. Try removing the photo and saving again.");
    }
  }

  function handleEditSavedSpot() {
    if (!savedRecord) return;
    setPlace(savedRecord.place);
    setLevel(savedRecord.level);
    setBlock(savedRecord.block);
    setBay(savedRecord.bay);
    setPhoto(savedRecord.photo);
    setCoordinates(savedRecord.coordinates);
    setIsEditing(true);
  }

  function handleRemoveSavedParking() {
    window.localStorage.removeItem(PARKING_STORAGE_KEY);
    notifyParkingSubscribers();
    setPlace("");
    setLevel("");
    setBlock("");
    setBay("");
    setPhoto(null);
    setCoordinates(null);
    setIsEditing(false);
    setIsConfirmingRemoval(false);
    setMessage("Saved parking removed.");
  }

  return (
    <main className="finder-page parking-page">
      <header className="finder-header">
        <Link className="finder-brand" href="/" aria-label="Arah home">
          <span className="finder-brand-mark" aria-hidden="true">a</span>
          <span>arah</span>
        </Link>
        <span className="finder-header-label">Parking note</span>
        <Link className="finder-back" href="/">Back home <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="parking-intro" aria-labelledby="parking-title">
        <p className="eyebrow">FOR THE WAY BACK</p>
        <h1 id="parking-title">Where did you park?</h1>
        <p>Save a level and block, then add a photo or GPS pin if useful.</p>
      </section>

      {savedRecord && !isEditing ? (
        <section className="parking-saved" aria-live="polite">
          <div className="parking-saved-icon" aria-hidden="true">✓</div>
          <p className="eyebrow">PARKING SAVED</p>
          <h2>{savedRecord.place}</h2>
          <p className="parking-saved-location">
            Level {savedRecord.level} <span>/</span> Block {savedRecord.block}
            {savedRecord.bay ? <><span>/</span> Bay {savedRecord.bay}</> : null}
          </p>
          {savedRecord.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="parking-saved-photo" src={savedRecord.photo} alt="Saved car park photo" />
          )}
          {savedRecord.coordinates && (
            <a
              className="parking-map-link"
              href={`https://www.google.com/maps?q=${savedRecord.coordinates.lat},${savedRecord.coordinates.lon}`}
              target="_blank"
              rel="noreferrer"
            >
              Open saved GPS pin <span aria-hidden="true">↗</span>
            </a>
          )}
          <p className="parking-saved-time">Saved {new Date(savedRecord.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          {isConfirmingRemoval ? (
            <div className="parking-remove-confirm" role="group" aria-label="Confirm removal">
              <p>Remove this saved parking note?</p>
              <button
                className="parking-secondary-button"
                type="button"
                onClick={() => setIsConfirmingRemoval(false)}
              >
                Keep it
              </button>
              <button className="parking-danger-button" type="button" onClick={handleRemoveSavedParking}>
                Remove parking
              </button>
            </div>
          ) : (
            <div className="parking-saved-actions">
              <button className="parking-secondary-button" type="button" onClick={handleEditSavedSpot}>
                Edit parking note
              </button>
              <button className="parking-danger-button" type="button" onClick={() => setIsConfirmingRemoval(true)}>
                Remove saved parking
              </button>
            </div>
          )}
        </section>
      ) : (
        <form className="parking-form" onSubmit={handleSave}>
          <label className="parking-field parking-field-wide">
            <span>Mall or place</span>
            <input
              type="text"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder="e.g. AEON Mall Bukit Tinggi"
              autoComplete="organization"
              required
            />
          </label>

          <label className="parking-field">
            <span>Level</span>
            <input
              type="text"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              placeholder="e.g. P2 or Ground"
              required
            />
          </label>

          <label className="parking-field">
            <span>Block or zone</span>
            <input
              type="text"
              value={block}
              onChange={(event) => setBlock(event.target.value)}
              placeholder="e.g. Blue or B"
              required
            />
          </label>

          <label className="parking-field parking-field-wide">
            <span>Bay number <span className="parking-optional">Optional</span></span>
            <input
              type="text"
              value={bay}
              onChange={(event) => setBay(event.target.value)}
              placeholder="e.g. 24"
            />
          </label>

          <div className="parking-extra-actions parking-field-wide">
            <label className="parking-snap-button">
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} />
              <span aria-hidden="true">＋</span>
              <span>{photo ? "Replace parking photo" : "Snap parking photo"}</span>
            </label>
            <button className="parking-gps-button" type="button" onClick={handleLocate} disabled={isLocating}>
              <span aria-hidden="true">◎</span>
              {isLocating ? "Getting GPS..." : coordinates ? "GPS pin saved" : "Add GPS pin"}
            </button>
          </div>

          {photo && (
            <div className="parking-photo-preview parking-field-wide">
              {/* The preview comes from a compressed user-selected local image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Preview of the parking photo" />
              <button type="button" onClick={() => setPhoto(null)}>Remove photo</button>
            </div>
          )}

          {coordinates && (
            <p className="parking-gps-note parking-field-wide">
              GPS saved, accuracy about {Math.round(coordinates.accuracy)} m. Indoor GPS can be approximate.
            </p>
          )}

          {message && <p className="parking-form-message parking-field-wide" role="status">{message}</p>}

          <button className="parking-save-button parking-field-wide" type="submit">
            Save parking spot <span aria-hidden="true">↗</span>
          </button>
          <p className="parking-privacy parking-field-wide">Your parking note is stored on this device.</p>
        </form>
      )}
    </main>
  );
}