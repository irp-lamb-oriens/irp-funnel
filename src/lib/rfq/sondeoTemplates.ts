/**
 * src/lib/rfq/sondeoTemplates.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Pre-translated provider RFQ ("Sondeo") templates. The operator picks a
 * language; each language has a hand-made translation of the same structure so
 * we never call an LLM at send time.
 *
 * The rendered HTML carries two placeholders that the BACKEND fills per
 * recipient at send time, so a single edited preview personalizes for every
 * provider:
 *    {{providerName}}  → the provider's name (greeting)
 *    {{submitUrl}}     → that provider's tokenized "submit rates" link
 *
 * `fillPlaceholders()` is used on the frontend only to show a realistic preview.
 */

import type { SupportedRfqLang } from '$lib/i18n/countryLanguage.ts';

export type RfqLang = SupportedRfqLang;

export interface RfqFields {
  /** Required — a blank value is flagged by the missing-field detector. */
  origin: string;
  destination: string;
  serviceType: string;
  commodity: string;
  volume: string;
  /** Optional configurable sections. */
  serviceOptions: string[];
  notes: string;
}

export const RFQ_REQUIRED_FIELDS: (keyof RfqFields)[] = [
  'origin', 'destination', 'serviceType', 'commodity', 'volume',
];

export interface RfqLangOption {
  code: RfqLang;
  /** Native label shown in the selector. */
  label: string;
  /** English name for search/filtering. */
  englishName: string;
}

export const RFQ_LANG_OPTIONS: RfqLangOption[] = [
  { code: 'en', label: 'English', englishName: 'English' },
  { code: 'es', label: 'Español', englishName: 'Spanish' },
  { code: 'pt', label: 'Português', englishName: 'Portuguese' },
  { code: 'fr', label: 'Français', englishName: 'French' },
  { code: 'de', label: 'Deutsch', englishName: 'German' },
  { code: 'it', label: 'Italiano', englishName: 'Italian' },
  { code: 'ru', label: 'Русский', englishName: 'Russian' },
  { code: 'zh', label: '中文', englishName: 'Chinese' },
  { code: 'ja', label: '日本語', englishName: 'Japanese' },
  { code: 'ko', label: '한국어', englishName: 'Korean' },
  { code: 'hi', label: 'हिन्दी', englishName: 'Hindi' },
];

interface RfqStrings {
  subject: (o: string, d: string) => string;
  greeting: string;          // "Dear {{providerName}},"
  intro: string;
  shipmentHeading: string;
  labelOrigin: string;
  labelDestination: string;
  labelServiceType: string;
  labelCommodity: string;
  labelVolume: string;
  optionsHeading: string;
  notesHeading: string;
  specifyHeading: string;
  specify: string[];
  replyPrompt: string;       // primary path — reply by email
  submitPrompt: string;      // secondary path — portal link (contains {{submitUrl}})
  submitCta: string;
  closing: string;
  signoff: string;
  company: string;
  defaultOptions: string[];
  mscNote: string;
}

const DICT: Record<RfqLang, RfqStrings> = {
  en: {
    subject: (o, d) => `Rate request — ${o} → ${d}`,
    greeting: 'Dear {{providerName}},',
    intro: 'We kindly request your best rates for the following services:',
    shipmentHeading: 'Shipment Details',
    labelOrigin: 'Origin',
    labelDestination: 'Destination',
    labelServiceType: 'Type of Service',
    labelCommodity: 'Commodity / Cargo Description',
    labelVolume: 'Estimated Volume / Weight',
    optionsHeading: 'Service Options',
    notesHeading: 'Important Notes',
    specifyHeading: 'Please specify:',
    specify: [
      'Transit time (port-to-port)',
      'Validity of rates',
      'Surcharges and fees (BAF, CAF, ISPS, local charges, etc.)',
      'Carrier name and service details',
    ],
    replyPrompt: 'You can simply reply to this email with your best rates and we will review them.',
    submitPrompt: 'If you prefer, you can also submit your rates securely through our portal:',
    submitCta: 'Submit your rates',
    closing: 'We appreciate your prompt quotation and look forward to your reply.',
    signoff: 'Best regards,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'Option #1: Full-packing & Loading assistance included',
      'Option #2: Self-packing & Loading assistance included',
    ],
    mscNote: 'For shipments to Costa Rica, please do not quote with MSC.',
  },
  es: {
    subject: (o, d) => `Solicitud de tarifas — ${o} → ${d}`,
    greeting: 'Estimado/a {{providerName}}:',
    intro: 'Solicitamos amablemente sus mejores tarifas para los siguientes servicios:',
    shipmentHeading: 'Detalles del envío',
    labelOrigin: 'Origen',
    labelDestination: 'Destino',
    labelServiceType: 'Tipo de servicio',
    labelCommodity: 'Descripción de la mercancía / carga',
    labelVolume: 'Volumen / peso estimado',
    optionsHeading: 'Opciones de servicio',
    notesHeading: 'Notas importantes',
    specifyHeading: 'Por favor especifique:',
    specify: [
      'Tiempo de tránsito (puerto a puerto)',
      'Validez de las tarifas',
      'Recargos y cargos (BAF, CAF, ISPS, cargos locales, etc.)',
      'Nombre de la naviera y detalles del servicio',
    ],
    replyPrompt: 'Puede simplemente responder a este correo con sus mejores tarifas y las revisaremos.',
    submitPrompt: 'Si lo prefiere, también puede enviar sus tarifas de forma segura a través de nuestro portal:',
    submitCta: 'Enviar sus tarifas',
    closing: 'Agradecemos su pronta cotización y quedamos a la espera de su respuesta.',
    signoff: 'Saludos cordiales,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'Opción #1: Embalaje completo y asistencia de carga incluidos',
      'Opción #2: Autoembalaje y asistencia de carga incluidos',
    ],
    mscNote: 'Para envíos a Costa Rica, por favor no cotice con MSC.',
  },
  pt: {
    subject: (o, d) => `Solicitação de tarifas — ${o} → ${d}`,
    greeting: 'Prezado(a) {{providerName}},',
    intro: 'Solicitamos gentilmente suas melhores tarifas para os seguintes serviços:',
    shipmentHeading: 'Detalhes do embarque',
    labelOrigin: 'Origem',
    labelDestination: 'Destino',
    labelServiceType: 'Tipo de serviço',
    labelCommodity: 'Descrição da mercadoria / carga',
    labelVolume: 'Volume / peso estimado',
    optionsHeading: 'Opções de serviço',
    notesHeading: 'Observações importantes',
    specifyHeading: 'Por favor, especifique:',
    specify: [
      'Tempo de trânsito (porto a porto)',
      'Validade das tarifas',
      'Sobretaxas e taxas (BAF, CAF, ISPS, taxas locais, etc.)',
      'Nome do armador e detalhes do serviço',
    ],
    replyPrompt: 'Você pode simplesmente responder a este e-mail com suas melhores tarifas e nós as analisaremos.',
    submitPrompt: 'Se preferir, você também pode enviar suas tarifas com segurança através do nosso portal:',
    submitCta: 'Enviar suas tarifas',
    closing: 'Agradecemos sua cotação rápida e aguardamos sua resposta.',
    signoff: 'Atenciosamente,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'Opção #1: Embalagem completa e assistência de carga incluídas',
      'Opção #2: Auto-embalagem e assistência de carga incluídas',
    ],
    mscNote: 'Para embarques para a Costa Rica, por favor não cotar com a MSC.',
  },
  fr: {
    subject: (o, d) => `Demande de tarifs — ${o} → ${d}`,
    greeting: 'Cher/Chère {{providerName}},',
    intro: 'Nous vous prions de bien vouloir nous communiquer vos meilleurs tarifs pour les services suivants :',
    shipmentHeading: 'Détails de l’expédition',
    labelOrigin: 'Origine',
    labelDestination: 'Destination',
    labelServiceType: 'Type de service',
    labelCommodity: 'Description de la marchandise / cargaison',
    labelVolume: 'Volume / poids estimé',
    optionsHeading: 'Options de service',
    notesHeading: 'Remarques importantes',
    specifyHeading: 'Veuillez préciser :',
    specify: [
      'Temps de transit (port à port)',
      'Validité des tarifs',
      'Surcharges et frais (BAF, CAF, ISPS, frais locaux, etc.)',
      'Nom du transporteur et détails du service',
    ],
    replyPrompt: 'Vous pouvez simplement répondre à cet e-mail avec vos meilleurs tarifs et nous les examinerons.',
    submitPrompt: 'Si vous préférez, vous pouvez également soumettre vos tarifs en toute sécurité via notre portail :',
    submitCta: 'Soumettre vos tarifs',
    closing: 'Nous vous remercions de votre cotation rapide et attendons votre réponse.',
    signoff: 'Cordialement,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'Option n°1 : Emballage complet et assistance au chargement inclus',
      'Option n°2 : Auto-emballage et assistance au chargement inclus',
    ],
    mscNote: 'Pour les expéditions vers le Costa Rica, veuillez ne pas coter avec MSC.',
  },
  de: {
    subject: (o, d) => `Ratenanfrage — ${o} → ${d}`,
    greeting: 'Sehr geehrte/r {{providerName}},',
    intro: 'Wir bitten höflich um Ihre besten Raten für die folgenden Leistungen:',
    shipmentHeading: 'Sendungsdetails',
    labelOrigin: 'Ursprung',
    labelDestination: 'Bestimmungsort',
    labelServiceType: 'Art des Service',
    labelCommodity: 'Waren- / Frachtbeschreibung',
    labelVolume: 'Geschätztes Volumen / Gewicht',
    optionsHeading: 'Service-Optionen',
    notesHeading: 'Wichtige Hinweise',
    specifyHeading: 'Bitte geben Sie an:',
    specify: [
      'Transitzeit (Hafen zu Hafen)',
      'Gültigkeit der Raten',
      'Zuschläge und Gebühren (BAF, CAF, ISPS, lokale Kosten usw.)',
      'Name der Reederei und Service-Details',
    ],
    replyPrompt: 'Sie können einfach auf diese E-Mail mit Ihren besten Raten antworten, und wir werden sie prüfen.',
    submitPrompt: 'Wenn Sie möchten, können Sie Ihre Raten auch sicher über unser Portal übermitteln:',
    submitCta: 'Ihre Raten übermitteln',
    closing: 'Wir danken Ihnen für Ihr rasches Angebot und freuen uns auf Ihre Antwort.',
    signoff: 'Mit freundlichen Grüßen,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'Option Nr. 1: Komplettverpackung und Verladehilfe inbegriffen',
      'Option Nr. 2: Selbstverpackung und Verladehilfe inbegriffen',
    ],
    mscNote: 'Für Sendungen nach Costa Rica bitte nicht mit MSC anbieten.',
  },
  it: {
    subject: (o, d) => `Richiesta tariffe — ${o} → ${d}`,
    greeting: 'Gentile {{providerName}},',
    intro: 'Vi chiediamo cortesemente le vostre migliori tariffe per i seguenti servizi:',
    shipmentHeading: 'Dettagli della spedizione',
    labelOrigin: 'Origine',
    labelDestination: 'Destinazione',
    labelServiceType: 'Tipo di servizio',
    labelCommodity: 'Descrizione della merce / carico',
    labelVolume: 'Volume / peso stimato',
    optionsHeading: 'Opzioni di servizio',
    notesHeading: 'Note importanti',
    specifyHeading: 'Si prega di specificare:',
    specify: [
      'Tempo di transito (porto a porto)',
      'Validità delle tariffe',
      'Sovrapprezzi e oneri (BAF, CAF, ISPS, oneri locali, ecc.)',
      'Nome del vettore e dettagli del servizio',
    ],
    replyPrompt: 'Può semplicemente rispondere a questa e-mail con le sue migliori tariffe e le esamineremo.',
    submitPrompt: 'Se preferisce, può anche inviare le sue tariffe in modo sicuro tramite il nostro portale:',
    submitCta: 'Invia le tue tariffe',
    closing: 'La ringraziamo per la sollecita quotazione e restiamo in attesa di un suo riscontro.',
    signoff: 'Cordiali saluti,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'Opzione n. 1: Imballaggio completo e assistenza al carico inclusi',
      'Opzione n. 2: Auto-imballaggio e assistenza al carico inclusi',
    ],
    mscNote: 'Per le spedizioni verso la Costa Rica, si prega di non quotare con MSC.',
  },
  ru: {
    subject: (o, d) => `Запрос ставок — ${o} → ${d}`,
    greeting: 'Уважаемый(ая) {{providerName}},',
    intro: 'Просим вас предоставить ваши лучшие ставки на следующие услуги:',
    shipmentHeading: 'Детали отправки',
    labelOrigin: 'Пункт отправления',
    labelDestination: 'Пункт назначения',
    labelServiceType: 'Тип услуги',
    labelCommodity: 'Описание груза',
    labelVolume: 'Ориентировочный объём / вес',
    optionsHeading: 'Варианты услуг',
    notesHeading: 'Важные примечания',
    specifyHeading: 'Пожалуйста, укажите:',
    specify: [
      'Время в пути (порт — порт)',
      'Срок действия ставок',
      'Надбавки и сборы (BAF, CAF, ISPS, местные сборы и т. д.)',
      'Название перевозчика и детали сервиса',
    ],
    replyPrompt: 'Вы можете просто ответить на это письмо, указав ваши лучшие ставки, и мы их рассмотрим.',
    submitPrompt: 'При желании вы также можете безопасно отправить ставки через наш портал:',
    submitCta: 'Отправить ставки',
    closing: 'Благодарим за оперативное предложение и ждём вашего ответа.',
    signoff: 'С уважением,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'Вариант №1: Полная упаковка и помощь с погрузкой включены',
      'Вариант №2: Самостоятельная упаковка и помощь с погрузкой включены',
    ],
    mscNote: 'Для отправок в Коста-Рику, пожалуйста, не предлагайте MSC.',
  },
  zh: {
    subject: (o, d) => `报价请求 — ${o} → ${d}`,
    greeting: '尊敬的 {{providerName}}：',
    intro: '我们诚挚地请求贵司提供以下服务的最优报价：',
    shipmentHeading: '货运详情',
    labelOrigin: '起运地',
    labelDestination: '目的地',
    labelServiceType: '服务类型',
    labelCommodity: '货物 / 货品说明',
    labelVolume: '预计体积 / 重量',
    optionsHeading: '服务选项',
    notesHeading: '重要提示',
    specifyHeading: '请注明：',
    specify: [
      '运输时间（港到港）',
      '报价有效期',
      '附加费和费用（BAF、CAF、ISPS、当地费用等）',
      '承运人名称及服务详情',
    ],
    replyPrompt: '您可以直接回复此邮件并附上最优报价，我们将进行审核。',
    submitPrompt: '如您愿意，也可以通过我们的门户安全地提交报价：',
    submitCta: '提交您的报价',
    closing: '感谢贵司及时报价，期待您的回复。',
    signoff: '此致敬礼，',
    company: 'International Relocation Partner',
    defaultOptions: [
      '选项 #1：含全程打包及装货协助',
      '选项 #2：自行打包，含装货协助',
    ],
    mscNote: '发往哥斯达黎加的货物，请勿使用 MSC 报价。',
  },
  ja: {
    subject: (o, d) => `料金のご依頼 — ${o} → ${d}`,
    greeting: '{{providerName}} 御中',
    intro: '以下のサービスについて、貴社のベストレートをご提示いただけますようお願い申し上げます。',
    shipmentHeading: '出荷情報',
    labelOrigin: '出発地',
    labelDestination: '目的地',
    labelServiceType: 'サービスの種類',
    labelCommodity: '商品 / 貨物の内容',
    labelVolume: '推定容積 / 重量',
    optionsHeading: 'サービスオプション',
    notesHeading: '重要な注意事項',
    specifyHeading: '以下をご明記ください：',
    specify: [
      '輸送時間（港から港）',
      'レートの有効期限',
      'サーチャージおよび諸費用（BAF、CAF、ISPS、ローカルチャージ等）',
      '船会社名およびサービス詳細',
    ],
    replyPrompt: '本メールにベストレートをご返信いただければ、確認いたします。',
    submitPrompt: 'ご希望の場合は、当社ポータルから安全にレートをご提出いただくことも可能です：',
    submitCta: 'レートを提出する',
    closing: '迅速なお見積もりに感謝申し上げ、ご返信をお待ちしております。',
    signoff: '敬具',
    company: 'International Relocation Partner',
    defaultOptions: [
      'オプション #1：フルパッキングおよび積み込み補助を含む',
      'オプション #2：セルフパッキング、積み込み補助を含む',
    ],
    mscNote: 'コスタリカ向けの貨物については、MSC での見積もりはご遠慮ください。',
  },
  ko: {
    subject: (o, d) => `요율 요청 — ${o} → ${d}`,
    greeting: '{{providerName}} 담당자님께,',
    intro: '다음 서비스에 대한 최선의 요율을 요청드립니다:',
    shipmentHeading: '선적 정보',
    labelOrigin: '출발지',
    labelDestination: '도착지',
    labelServiceType: '서비스 종류',
    labelCommodity: '품목 / 화물 설명',
    labelVolume: '예상 부피 / 중량',
    optionsHeading: '서비스 옵션',
    notesHeading: '중요 안내',
    specifyHeading: '다음 사항을 명시해 주십시오:',
    specify: [
      '운송 시간 (항구 대 항구)',
      '요율 유효 기간',
      '할증료 및 요금 (BAF, CAF, ISPS, 현지 비용 등)',
      '선사명 및 서비스 세부사항',
    ],
    replyPrompt: '이 이메일에 최선의 요율을 회신해 주시면 검토하겠습니다.',
    submitPrompt: '원하시면 당사 포털을 통해 안전하게 요율을 제출하실 수도 있습니다:',
    submitCta: '요율 제출하기',
    closing: '신속한 견적에 감사드리며 회신을 기다리겠습니다.',
    signoff: '감사합니다,',
    company: 'International Relocation Partner',
    defaultOptions: [
      '옵션 #1: 전체 포장 및 상차 지원 포함',
      '옵션 #2: 자가 포장, 상차 지원 포함',
    ],
    mscNote: '코스타리카행 화물은 MSC로 견적하지 말아 주십시오.',
  },
  hi: {
    subject: (o, d) => `दर अनुरोध — ${o} → ${d}`,
    greeting: 'प्रिय {{providerName}},',
    intro: 'हम निम्नलिखित सेवाओं के लिए आपकी सर्वोत्तम दरें सादर अनुरोध करते हैं:',
    shipmentHeading: 'शिपमेंट विवरण',
    labelOrigin: 'मूल स्थान',
    labelDestination: 'गंतव्य',
    labelServiceType: 'सेवा का प्रकार',
    labelCommodity: 'वस्तु / कार्गो विवरण',
    labelVolume: 'अनुमानित आयतन / भार',
    optionsHeading: 'सेवा विकल्प',
    notesHeading: 'महत्वपूर्ण सूचनाएँ',
    specifyHeading: 'कृपया निर्दिष्ट करें:',
    specify: [
      'पारगमन समय (पोर्ट से पोर्ट)',
      'दरों की वैधता',
      'अधिभार और शुल्क (BAF, CAF, ISPS, स्थानीय शुल्क, आदि)',
      'कैरियर का नाम और सेवा विवरण',
    ],
    replyPrompt: 'आप बस इस ईमेल का उत्तर अपनी सर्वोत्तम दरों के साथ दे सकते हैं और हम उनकी समीक्षा करेंगे।',
    submitPrompt: 'यदि आप चाहें, तो आप हमारे पोर्टल के माध्यम से भी सुरक्षित रूप से अपनी दरें जमा कर सकते हैं:',
    submitCta: 'अपनी दरें जमा करें',
    closing: 'हम आपकी त्वरित कोटेशन की सराहना करते हैं और आपके उत्तर की प्रतीक्षा करते हैं।',
    signoff: 'सादर,',
    company: 'International Relocation Partner',
    defaultOptions: [
      'विकल्प #1: पूर्ण पैकिंग और लोडिंग सहायता सहित',
      'विकल्प #2: स्व-पैकिंग, लोडिंग सहायता सहित',
    ],
    mscNote: 'कोस्टा रिका के लिए शिपमेंट हेतु, कृपया MSC के साथ कोट न करें।',
  },
};

const TEAL = '#37bcc3';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** The default service options for a language (used when none are set yet). */
export function defaultServiceOptions(lang: RfqLang): string[] {
  return [...(DICT[lang] ?? DICT.en).defaultOptions];
}

/** The translated "do not quote MSC" note for Costa Rica corridors. */
export function mscNote(lang: RfqLang): string {
  return (DICT[lang] ?? DICT.en).mscNote;
}

export function emptyRfqFields(lang: RfqLang = 'en'): RfqFields {
  return {
    origin: '',
    destination: '',
    serviceType: '',
    commodity: '',
    volume: '',
    serviceOptions: defaultServiceOptions(lang),
    notes: '',
  };
}

/** Return the required fields that are still blank. */
export function detectMissingRfqFields(fields: RfqFields): (keyof RfqFields)[] {
  return RFQ_REQUIRED_FIELDS.filter((k) => !String(fields[k] ?? '').trim());
}

/** Substitute {{providerName}} / {{submitUrl}} for a realistic preview. */
export function fillPlaceholders(
  html: string,
  map: { providerName?: string; submitUrl?: string },
): string {
  return html
    .replace(/\{\{providerName\}\}/g, esc(map.providerName ?? 'Partner'))
    .replace(/\{\{submitUrl\}\}/g, map.submitUrl ?? '#');
}

export interface RenderedRfq {
  subject: string;
  /** HTML with {{providerName}} / {{submitUrl}} placeholders intact. */
  bodyHtml: string;
}

/**
 * Render the RFQ email for a language. Placeholders are LEFT INTACT so the
 * backend can personalize per recipient.
 */
export function renderRfqEmail(lang: RfqLang, fields: RfqFields): RenderedRfq {
  const t = DICT[lang] ?? DICT.en;
  const o = esc(fields.origin);
  const d = esc(fields.destination);

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 12px 6px 0;font-weight:600;color:#111;white-space:nowrap;vertical-align:top;">${esc(label)}:</td>
      <td style="padding:6px 0;color:#333;">${esc(value)}</td>
    </tr>`;

  const options = (fields.serviceOptions ?? []).filter((x) => String(x).trim());
  const optionsBlock = options.length
    ? `
    <h3 style="margin:24px 0 8px;font-size:15px;color:${TEAL};">${esc(t.optionsHeading)}</h3>
    <ul style="margin:0;padding-left:20px;color:#333;">
      ${options.map((x) => `<li style="margin:4px 0;">${esc(x)}</li>`).join('')}
    </ul>`
    : '';

  const notesBlock = String(fields.notes ?? '').trim()
    ? `
    <h3 style="margin:24px 0 8px;font-size:15px;color:${TEAL};">${esc(t.notesHeading)}</h3>
    <p style="margin:0;color:#333;white-space:pre-line;">${esc(fields.notes)}</p>`
    : '';

  const specifyBlock = `
    <h3 style="margin:24px 0 8px;font-size:15px;color:${TEAL};">${esc(t.specifyHeading)}</h3>
    <ul style="margin:0;padding-left:20px;color:#333;">
      ${t.specify.map((x) => `<li style="margin:4px 0;">${esc(x)}</li>`).join('')}
    </ul>`;

  const bodyInner = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px 28px;color:#111;line-height:1.55;">
    <p style="font-size:16px;font-weight:700;margin:0 0 16px;">${t.greeting}</p>
    <p style="margin:0 0 20px;color:#333;">${esc(t.intro)}</p>

    <h3 style="margin:20px 0 8px;font-size:15px;color:${TEAL};">${esc(t.shipmentHeading)}</h3>
    <table style="border-collapse:collapse;width:100%;">
      ${row(t.labelOrigin, fields.origin)}
      ${row(t.labelDestination, fields.destination)}
      ${row(t.labelServiceType, fields.serviceType)}
      ${row(t.labelCommodity, fields.commodity)}
      ${row(t.labelVolume, fields.volume)}
    </table>
    ${optionsBlock}
    ${notesBlock}
    ${specifyBlock}

    <p style="margin:24px 0 8px;color:#333;">${esc(t.replyPrompt)}</p>

    <p style="margin:24px 0 4px;color:#333;">${esc(t.closing)}</p>
    <p style="margin:16px 0 0;color:#333;">${esc(t.signoff)}</p>
    <p style="margin:2px 0 0;font-weight:700;color:${TEAL};">${esc(t.company)}</p>
  </div>`;

  return {
    subject: t.subject(o.replace(/&amp;/g, '&'), d.replace(/&amp;/g, '&')),
    bodyHtml: `<div style="border-top:6px solid ${TEAL};background:#fff;">${bodyInner}</div>`,
  };
}
