import { get } from "svelte/store";
import { formState, type FormState } from "./formStore.js";

export async function submitScheduling() {
  const { scheduling } = get(formState) as FormState;

  // Prepara los datos del evento
  const schedulingData = scheduling.map((dateTime: string) => {
    return {
      summary: `Scheduled Consultation`,
      description: `Desired moving date: ${scheduling.join(", ")}`,
      start: {
        dateTime,
        timeZone: "America/Costa_Rica",
      },
      end: {
        dateTime: new Date(
          new Date(dateTime).getTime() + 60 * 60 * 1000 * 1.5
        ).toISOString(),
        timeZone: "America/Costa_Rica",
      },
    };
  });

  console.log("Scheduling data to be sent to backend:", schedulingData);

  try {
    // Envía los datos del evento al backend
    const response = await fetch(
      "https://irp-funnel-server.onrender.com/api/submit-schedule",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          events: schedulingData,
        }),
      }
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error("Backend response details:", errorDetails);
      throw new Error("Failed to submit scheduling data");
    }

    console.log(
      "Scheduling data successfully submitted to backend:",
      schedulingData
    );
  } catch (error) {
    console.error("Error submitting scheduling data to backend:", error);
    if (error.response) {
      console.error("API response status:", error.response.status);
      console.error("API response data:", error.response.data);
    }
    alert(
      "Error al enviar el horario. Por favor, comuníquese inmediatamente con consultation@internationalrelocationpartner.com para que podamos agendar la cita"
    );
  }
}
