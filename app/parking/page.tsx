import type { Metadata } from "next";
import ParkingForm from "./parking-form";

export const metadata: Metadata = {
  title: "Save Parking | Arah",
  description: "Save your parking level, block, and a quick photo for later.",
};

export default function ParkingPage() {
  return <ParkingForm />;
}