import { get } from "svelte/store";
import { formState, type FormState } from "./formStore.js";
import store from "../../../store.js";

export async function submitScheduling() {
  const formData = get(formState);

  const schedulingData = formData.scheduling.map((dateTime: string) => {
    return {
      summary: `Scheduled Consultation with ${formData.name}`,
      description: `Consultation for ${formData.name} regarding moving from ${formData.originCountry} to ${formData.destinationCountry}. Budget: ${formData.budget}.`,
      start: {
        dateTime,
        timeZone: "America/Costa_Rica",
      },
      end: {
        dateTime: new Date(
          new Date(dateTime).getTime() + 30 * 60 * 1000
        ).toISOString(),
        timeZone: "America/Costa_Rica",
      },
    };
  });

  const submissionData = {
    ...formData,
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
