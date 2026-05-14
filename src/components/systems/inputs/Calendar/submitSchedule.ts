import { get } from "svelte/store";
import { formState, type FormState } from "./formStore.js";
import store from "../../../store.js";

export async function submitScheduling(evoConsultationPriceVariant?: string) {
  const formData = get(formState);
  console.log("Form data from store:", formData);

  const schedulingData = formData.scheduling.map((dateTime: string) => {
    const startDate = new Date(dateTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const notesStr = Array.isArray(formData.notes) ? formData.notes.join('\n- ') : (formData.notes || 'None');

    return {
      summary: `Scheduled Consultation with ${formData.name} ${formData.surname}`,
      description: `Consultation for ${formData.name} ${formData.surname} regarding moving from ${formData.originCity ? formData.originCity + ', ' : ''}${formData.originCountry} to ${formData.destinationCity ? formData.destinationCity + ', ' : ''}${formData.destinationCountry}. Budget: ${formData.budget}.\n\nNotes: ${notesStr}.`,
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

  const submissionData = {
    ...formData,
    events: schedulingData,
    evoVisitorId: (window as any).__EVO_SESSION__ || null,
    evoConsultationPriceVariant
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

    // Handle scheduling policy violations gracefully
    if (response.status === 422) {
      const errorData = await response.json();
      console.warn("[submitSchedule] Scheduling policy violation:", errorData);
      
      if (errorData.code === "too_soon") {
        alert(
          "This time slot requires at least 2 business days advance notice. Please go back and select a later date."
        );
      } else if (errorData.code === "outside_hours") {
        alert(
          "This time is outside our consultation hours (Mon–Fri, 9 AM – 4 PM Standard Central Time). Please go back and pick another slot."
        );
      } else {
        alert(
          "This time slot is no longer available. Please go back and select a different time."
        );
      }
      return null;
    }

    // Handle duplicate bookings gracefully
    if (response.status === 409) {
      const errorData = await response.json();
      console.warn("[submitSchedule] Duplicate booking detected:", errorData);
      alert(
        "You already have a consultation booked around this time! Check your email for the details, or pick a different time."
      );
      return null;
    }

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
