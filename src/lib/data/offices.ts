/**
 * IRP offices, shared by the old ContactSection and the home's offices
 * scene (components/landing/OfficesScene.svelte). Addresses may hold <br>
 * line breaks; `extra` is trusted HTML written here.
 */
export interface LocationDetail {
  label: string;
  address: string;
  email?: string;
  emailHref?: string;
  extra?: string;
  imgAlt: string;
}

export interface LocationCard {
  country: string;
  details: LocationDetail[];
}

export const locations: LocationCard[] = [
  {
    country: "United States",
    details: [
      {
        label: "International Relocation Partner LLC",
        address: "175 SW 7th Street STE 1517 - 559<br>MIAMI FLORIDA 33130",
        email: "unitedstates@internationalrelocationpartner.com",
        imgAlt: "US Map",
        emailHref: "mailto:unitedstates@internationalrelocationpartner.com",
        extra: "Please email <a href=\"mailto:unitedstates@internationalrelocationpartner.com\">unitedstates@internationalrelocationpartner.com</a> or schedule a consultation call with a United States expert."
      }
    ]
  },
  {
    country: "Mexico",
    details: [
      {
        label: "International Relocation Partner",
        address: "Edif New York Life<br>Paseo de la Reforma 342, Piso 26<br>Col. Juárez, Del. Cuauhtémoc<br>Ciudad de México, C.P. 06600",
        email: "mexico@internationalrelocationpartner.com",
        imgAlt: "Mexico Map",
        emailHref: "mailto:mexico@internationalrelocationpartner.com",
        extra: "Please email <a href=\"mailto:mexico@internationalrelocationpartner.com\">mexico@internationalrelocationpartner.com</a> or schedule a consultation call with a Mexico expert."
      }
    ]
  },
  {
    country: "Costa Rica",
    details: [
      {
        label: "Alajuela",
        address: "700 metros al este del cruce del aeropuerto Juan SantaMaria, Carretera a Heredia, WF Office Building, Alajuela Province, Río Segundo, 20109",
        email: "costarica@internationalrelocationpartner.com",
        imgAlt: "Costa Rica Map",
        extra: "Please email costarica@internationalrelocationpartner.com or schedule a consultation call with a Costa Rica expert."
      },
      {
        label: "Guanacaste",
        address: "A 1.5kms norte de la plaza de futbol de Villarreal. Camino a Huacas, 500 metros después de la gasolinera. Tamarindo, Guanacaste",
        email: "costarica@internationalrelocationpartner.com",
        imgAlt: "Costa Rica Map",
        extra: "Please email costarica@internationalrelocationpartner.com or schedule a consultation call with a Costa Rica expert."
      }
    ]
  },
  {
    country: "Panamá",
    details: [
      {
        label: "Panama City",
        address: "PH Grupo Pistar, Vía Simón Bolivar Oficina 239",
        email: "panama@internationalrelocationpartner.com",
        imgAlt: "Panama Map",
        extra: "Please email panama@internationalrelocationpartner.com or schedule a consultation call with a Panama expert."
      },
      {
        label: "Boquete",
        address: "Coming soon to Boquete, Chiriquí, Panama",
        email: "panama@internationalrelocationpartner.com",
        imgAlt: "Panama Map",
        extra: "Please email panama@internationalrelocationpartner.com or schedule a consultation call with a Panama expert."
      }
    ]
  },
  {
    country: "Spain",
    details: [
      {
        label: "",
        address: "Calle Bolivia 17, 11ºB, 28016, Madrid, Spain.",
        imgAlt: "Spain Map"
      }
    ]
  }
];
