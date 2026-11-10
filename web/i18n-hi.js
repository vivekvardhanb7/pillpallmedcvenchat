// Hindi UI preview. Requires native-speaker clinical review before release.
// Missing interface keys explicitly fall back to English.
export const HINDI_PREVIEW = {
  app: { tapToStart: 'शुरू करने के लिए टैप करें', tapToSpeak: 'बोलने के लिए टैप करें', researchMode: 'परीक्षण मोड' },
  question: {
    symptom: { title: 'आपको किस समस्या में मदद चाहिए?', subtitle: 'सबसे नज़दीकी विकल्प चुनें। यह निदान नहीं है।' },
    age: { title: 'मरीज़ की उम्र कितनी है?', subtitle: 'उम्र पूरे वर्षों में लिखें।' },
    duration: { title: 'यह समस्या कितने समय से है?' },
    severity: { title: 'समस्या कितनी गंभीर है?' },
    // Keep the complete existing English red-flag list until independently reviewed.
    warning_signs: { title: 'क्या बताए गए गंभीर चेतावनी संकेतों में से कोई है?' },
    safety_background_status: { title: 'क्या गर्भावस्था, स्तनपान, दवा से एलर्जी, वर्तमान दवाएँ या कोई पुरानी बीमारी लागू होती है?', subtitle: 'सभी बातें लागू न होने पर ही कोई नहीं चुनें।' },
    pregnancy_breastfeeding: { title: 'क्या मरीज़ गर्भवती है या स्तनपान करा रही है?' },
    medical_history_status: { title: 'क्या दवा से एलर्जी, वर्तमान दवाएँ या कोई पुरानी बीमारी है?' },
    allergy_status: { title: 'क्या मरीज़ को किसी दवा से एलर्जी है?' },
    allergy_terms: { title: 'किन दवाओं या सामग्री से एलर्जी है?', subtitle: 'एक से अधिक नाम अल्पविराम से अलग करें।' },
    medication_status: { title: 'क्या मरीज़ अभी कोई दवा ले रहा है?' },
    medication_terms: { title: 'मरीज़ कौन सी दवाएँ ले रहा है?', subtitle: 'बिना पर्चे की दवाएँ भी शामिल करें।' },
    condition_status: { title: 'क्या मरीज़ को कोई पुरानी बीमारी है?' },
    condition_terms: { title: 'कौन सी पुरानी बीमारियाँ हैं?' },
    confirm: { title: 'कृपया अपने उत्तरों की पुष्टि करें' },
  },
  option: {
    symptom: { pain_fever: 'सिरदर्द, दर्द या बुखार', cold_cough: 'सर्दी या खाँसी', allergy: 'एलर्जी', diarrhoea: 'दस्त', heartburn: 'सीने में जलन या पेट की परेशानी', skin_minor_wound: 'त्वचा या छोटा घाव', other: 'अन्य समस्या' },
    duration: { today: 'आज शुरू हुआ', '1_to_2_days': '1–2 दिन', '3_to_7_days': '3–7 दिन', more_than_7_days: '7 दिन से अधिक' },
    severity: { mild: 'हल्का', moderate: 'मध्यम', severe: 'गंभीर' },
    warning_signs: { no: 'नहीं, इनमें से कोई नहीं', yes: 'हाँ, एक या अधिक', not_sure: 'मुझे निश्चित नहीं है' },
    safety_background_status: { none: 'नहीं, इनमें से कोई नहीं', pregnancy: 'गर्भावस्था या स्तनपान', history: 'एलर्जी, दवाएँ या पुरानी बीमारी', both: 'दोनों समूह लागू होते हैं', not_sure: 'मुझे निश्चित नहीं है' },
    pregnancy_breastfeeding: { pregnant: 'गर्भवती', breastfeeding: 'स्तनपान', both: 'दोनों', no: 'नहीं', not_applicable: 'लागू नहीं', prefer_not_to_say: 'बताना नहीं चाहते' },
    allergy_status: { no: 'नहीं', yes: 'हाँ', not_sure: 'निश्चित नहीं' },
    medication_status: { no: 'नहीं', yes: 'हाँ', not_sure: 'निश्चित नहीं' },
    condition_status: { no: 'नहीं', yes: 'हाँ', not_sure: 'निश्चित नहीं' },
    confirm: { yes: 'पुष्टि करें और जाँच करें', no: 'फिर से शुरू करें' },
  },
};
