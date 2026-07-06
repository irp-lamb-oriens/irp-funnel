import { get } from "svelte/store";
import { formState, type FormState } from "./formStore.js";
import store from "../../../store.js";

export async function submitScheduling() {
  const formData = get(formState);
  console.log("Form data from store:", formData);

  const schedulingData = formData.scheduling.map((dateTime: string) => {
    const startDate = new Date(dateTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    return {
      summary: `Scheduled Consultation with ${formData.name} ${formData.surname}`,
      description: `Consultation for ${formData.name} ${formData.surname} regarding moving from ${formData.originCity ? formData.originCity + ', ' : ''}${formData.originCountry} to ${formData.destinationCity ? formData.destinationCity + ', ' : ''}${formData.destinationCountry}. Budget: ${formData.budget}.`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "America/Costa_Rica",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "America/Costa_Rica",
      },
    };
  });

  // Normalise `notes` into the array-of-note-objects shape the backend and every
  // downstream email template expect. The HeroForm's notes step binds a
  // <textarea> straight to formState.notes, so it arrives here as a RAW STRING.
  // Sending it as a string used to persist it verbatim in Firestore, which later
  // crashed the email queue with "agentNotes.map is not a function" (a string has
  // .length but no .map). The backend now normalises too (defense-in-depth), but
  // we shape it correctly at the source so the whole stack stays consistent.
  const normalisedNotes = (() => {
    const raw = (formData as any).notes;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim()) {
      return [{ text: raw.trim(), createdAt: new Date().toISOString() }];
    }
    return [];
  })();

  const submissionData = {
    ...formData,
    notes: normalisedNotes,
    events: schedulingData,
  };


  console.log("Form data to be sent to backend:", submissionData);

  try {
    const response = await fetch(
      `${get(store).apiURL()}/api/send-hero-consultation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      }
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error("Backend response details:", errorDetails);
      throw new Error("Failed to submit scheduling data");
    }

    console.log(
      "Scheduling data successfully submitted to backend:",
      submissionData
    );

    return await response.json();
  } catch (error: any) {
    console.error("Error submitting scheduling data to backend:", error);
    if (error.response) {
      console.error("API response status:", error.response.status);
      console.error("API response data:", error.response.data);
    }
    alert(
      "Error submitting the schedule. Please contact consultation@internationalrelocationpartner.com immediately to schedule your appointment."
    );
  }
}
