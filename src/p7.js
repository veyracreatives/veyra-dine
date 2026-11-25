
/* ---------- Hindi and Marathi for the parent and coach apps ----------
   Buttons, labels and messages are translated. Names, notices, drills and anything the academy types stay as typed. */
const LANGS = [['en', 'English'], ['hi', 'हिंदी'], ['mr', 'मराठी']];
let LANG = (() => { try { const v = localStorage.getItem('vf-lang'); return ['hi', 'mr'].includes(v) ? v : 'en'; } catch (_) { return 'en'; } })();
function setLang(v) { LANG = ['hi', 'mr'].includes(v) ? v : 'en'; try { localStorage.setItem('vf-lang', LANG); } catch (_) {} document.documentElement.lang = LANG === 'en' ? 'en-IN' : LANG; rerender(); }
const i18nRole = () => !!(B && B.me && (B.me.role === 'parent' || B.me.role === 'coach'));
const i18nOn = () => LANG !== 'en' && i18nRole() && route().view === 'app';
function langPicker() { return i18nRole() ? `<label class="lang-pick" title="Language"><span class="sr">Language</span>${ic('globe')}<select data-lang aria-label="Language">${LANGS.map(([k, l]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''; }

// English | Hindi | Marathi
const I18 = `Today|आज|आज
Take attendance|हाज़िरी लें|हजेरी घ्या
Training plan|ट्रेनिंग प्लान|ट्रेनिंग प्लॅन
Matches|मैच|सामने
Player progress|खिलाड़ी की प्रगति|खेळाडूची प्रगती
My attendance|मेरी हाज़िरी|माझी हजेरी
Notices|सूचनाएँ|सूचना
Home|होम|होम
Mark|हाज़िरी|हजेरी
Training|ट्रेनिंग|ट्रेनिंग
More|और|अधिक
Menu|मेन्यू|मेन्यू
Attendance|हाज़िरी|हजेरी
Fees|फ़ीस|फी
Progress & health|प्रगति और सेहत|प्रगती आणि आरोग्य
Progress|प्रगति|प्रगती
Coach app|कोच ऐप|कोच ॲप
Parent app|पेरेंट ऐप|पालक ॲप
Coach|कोच|कोच
Parent|पेरेंट|पालक
Head coach|मुख्य कोच|मुख्य कोच
Hi|नमस्ते|नमस्कार
Check in|चेक इन|चेक इन
Checked in|चेक इन हो गया|चेक इन झाले
My sessions today|आज के मेरे सेशन|आजचे माझे सेशन
Injured players|घायल खिलाड़ी|जखमी खेळाडू
Out|बाहर|बाहेर
Next match|अगला मैच|पुढचा सामना
Open|खोलें|उघडा
Latest notice|ताज़ा सूचना|नवीन सूचना
Tap All present, then change the few who missed.|पहले "सब मौजूद" दबाएँ, फिर जो नहीं आए उन्हें बदलें।|आधी "सगळे हजर" दाबा, मग जे आले नाहीत त्यांना बदला.
Not saved|सेव नहीं हुआ|सेव्ह झाले नाही
Saved|सेव हो गया|सेव्ह झाले
Present|मौजूद|हजर
Late|देर से|उशिरा
Absent|ग़ैरहाज़िर|गैरहजर
All present|सब मौजूद|सगळे हजर
Save and tell parents|सेव करें और पेरेंट्स को बताएँ|सेव्ह करा आणि पालकांना कळवा
Batch|बैच|बॅच
Your plan for each batch. Change it any time.|हर बैच का प्लान। कभी भी बदलें।|प्रत्येक बॅचचा प्लॅन. कधीही बदला.
Edit plan|प्लान बदलें|प्लॅन बदला
Drill library|ड्रिल लाइब्रेरी|ड्रिल लायब्ररी
New|नया|नवीन
Squads, fixtures, results, scorers and certificates.|टीम, मैच, नतीजे, गोल करने वाले और सर्टिफ़िकेट।|संघ, सामने, निकाल, गोल करणारे आणि प्रमाणपत्रे.
Coming up|आने वाले|येणारे
in squad|टीम में|संघात
played|खेले|खेळले
won|जीते|जिंकले
Upcoming|आने वाला|येणारा
Add result|नतीजा जोड़ें|निकाल जोडा
Squad|टीम|संघ
Pick squad|टीम चुनें|संघ निवडा
Goals|गोल|गोल
Assists|असिस्ट|असिस्ट
Parents see these ratings and your note in their app.|पेरेंट्स ऐप में ये रेटिंग और आपका नोट देखते हैं।|पालक ॲपमध्ये हे रेटिंग आणि तुमची नोंद पाहतात.
Player|खिलाड़ी|खेळाडू
NOT SHARED YET|अभी भेजा नहीं|अजून पाठवले नाही
Passing|पासिंग|पासिंग
Dribbling|ड्रिब्लिंग|ड्रिब्लिंग
Shooting|शूटिंग|शूटिंग
First touch|फ़र्स्ट टच|फर्स्ट टच
Fitness|फ़िटनेस|फिटनेस
Teamwork|टीमवर्क|टीमवर्क
Note for parents|पेरेंट्स के लिए नोट|पालकांसाठी नोंद
Save and share|सेव करें और भेजें|सेव्ह करा आणि पाठवा
What went well, what to work on next|क्या अच्छा रहा, आगे किस पर काम करना है|काय चांगले झाले, पुढे कशावर काम करायचे
No session|सेशन नहीं|सेशन नाही
Recent check-ins|हाल के चेक-इन|अलीकडचे चेक-इन
Post a notice|सूचना भेजें|सूचना पाठवा
Title|शीर्षक|शीर्षक
Send to|किसे भेजें|कोणाला पाठवायचे
Message|संदेश|संदेश
It shows in their app straight away.|यह तुरंत उनके ऐप में दिखेगा।|हे लगेच त्यांच्या ॲपमध्ये दिसेल.
Post notice|सूचना भेजें|सूचना पाठवा
All parents|सभी पेरेंट्स|सर्व पालक
e.g. Kit day on Saturday|जैसे: शनिवार को किट डे|उदा. शनिवारी किट डे
What should they know?|उन्हें क्या जानना चाहिए?|त्यांना काय कळायला हवे?
Next session|अगला सेशन|पुढचे सेशन
See calendar|कैलेंडर देखें|कॅलेंडर पाहा
No matches coming up.|अभी कोई मैच नहीं है।|सध्या कोणताही सामना नाही.
Child|बच्चा|मूल
Month|महीना|महिना
Past payments|पिछले भुगतान|मागील पेमेंट
Paid in cash to the coach or the office? That counts too. The academy marks it paid and you get a receipt here.|कोच या ऑफ़िस में नकद दिया? वह भी गिना जाएगा। अकादमी उसे भरा हुआ मार्क करेगी और आपको यहाँ रसीद मिलेगी।|कोच किंवा ऑफिसमध्ये रोख दिले? तेही चालते. अकादमी ते भरले म्हणून नोंदवेल आणि तुम्हाला इथे पावती मिळेल.
Player of the match|मैन ऑफ़ द मैच|सामनावीर
In the squad|टीम में|संघात
Certificate|सर्टिफ़िकेट|प्रमाणपत्र
Runners-up|उपविजेता|उपविजेता
Winners|विजेता|विजेता
Progress card|प्रगति कार्ड|प्रगती कार्ड
Coach's note|कोच का नोट|कोचची नोंद
Badges|बैज|बॅज
Health & forms|सेहत और फ़ॉर्म|आरोग्य आणि फॉर्म
Edit|बदलें|बदला
Blood group|ब्लड ग्रुप|रक्तगट
Allergies|एलर्जी|ॲलर्जी
None|कोई नहीं|काही नाही
Note for coach|कोच के लिए नोट|कोचसाठी नोंद
Emergency contact|इमरजेंसी संपर्क|आपत्कालीन संपर्क
Forms|फ़ॉर्म|फॉर्म
Birth certificate|जन्म प्रमाणपत्र|जन्म दाखला
Not added yet|अभी नहीं जोड़ा|अजून जोडले नाही
Upload|अपलोड करें|अपलोड करा
Photo|फ़ोटो|फोटो
Added|जोड़ा गया|जोडले
View|देखें|पाहा
Medical form|मेडिकल फ़ॉर्म|मेडिकल फॉर्म
Parent consent|पेरेंट की सहमति|पालकांची संमती
Amount|रकम|रक्कम
Pay to|किसे भरें|कोणाला भरायचे
Copy|कॉपी करें|कॉपी करा
Copied|कॉपी हो गया|कॉपी झाले
Open UPI app|UPI ऐप खोलें|UPI ॲप उघडा
On a phone, tap Open UPI app. On a laptop, scan the code with GPay, PhonePe or Paytm. Then come back and paste the transaction ID.|फ़ोन पर "UPI ऐप खोलें" दबाएँ। लैपटॉप पर GPay, PhonePe या Paytm से कोड स्कैन करें। फिर वापस आकर ट्रांज़ैक्शन ID डालें।|फोनवर "UPI ॲप उघडा" दाबा. लॅपटॉपवर GPay, PhonePe किंवा Paytm ने कोड स्कॅन करा. मग परत येऊन ट्रान्झॅक्शन ID टाका.
I have paid|मैंने भर दिया|मी भरले आहे
UPI transaction ID (12 digits)|UPI ट्रांज़ैक्शन ID (12 अंक)|UPI ट्रान्झॅक्शन ID (12 अंक)
In your UPI app, open the payment and look for “UPI transaction ID” or “UTR”.|अपने UPI ऐप में पेमेंट खोलें और “UPI transaction ID” या “UTR” देखें।|तुमच्या UPI ॲपमध्ये पेमेंट उघडा आणि “UPI transaction ID” किंवा “UTR” पाहा.
or|या|किंवा
Upload payment screenshot|पेमेंट का स्क्रीनशॉट भेजें|पेमेंटचा स्क्रीनशॉट पाठवा
Change|बदलें|बदला
Back|पीछे|मागे
Send to academy|अकादमी को भेजें|अकादमीला पाठवा
Close|बंद करें|बंद करा
Cancel|रद्द करें|रद्द करा
Save|सेव करें|सेव्ह करा
Done|हो गया|झाले
Notifications|सूचनाएँ|सूचना
Mark all read|सब पढ़ा हुआ करें|सगळे वाचले
No notifications yet|अभी कोई सूचना नहीं|अजून सूचना नाहीत
Paid|भरा हुआ|भरले
Overdue|बकाया|थकीत
To check|जाँच बाकी|तपासणी बाकी
Being checked|जाँच हो रही है|तपासणी सुरू आहे
Receipt|रसीद|पावती
Language|भाषा|भाषा
My account|मेरा अकाउंट|माझे खाते
Log out|लॉग आउट|लॉग आउट
Install the app|ऐप इंस्टॉल करें|ॲप इंस्टॉल करा
Sent. The academy will confirm soon.|भेज दिया। अकादमी जल्द ही पुष्टि करेगी।|पाठवले. अकादमी लवकरच खात्री करेल.
Checked in. Have a good session.|चेक इन हो गया। अच्छा सेशन हो।|चेक इन झाले. सेशन छान होवो.
Notice posted|सूचना भेज दी|सूचना पाठवली
Progress card shared with the parent|प्रगति कार्ड पेरेंट को भेज दिया|प्रगती कार्ड पालकांना पाठवले
Pick a batch|बैच चुनें|बॅच निवडा
Some marks are waiting. They send when the network is back.|कुछ हाज़िरी रुकी है। नेटवर्क आते ही भेजी जाएगी।|काही हजेरी थांबली आहे. नेटवर्क आल्यावर पाठवली जाईल.
Cash|नकद|रोख
Schedule|शेड्यूल|वेळापत्रक
Fixture|मैच|सामना
General|सामान्य|सामान्य
Kit|किट|किट
Holiday|छुट्टी|सुट्टी
Cup|कप|कप
League|लीग|लीग
Friendly|फ़्रेंडली|मैत्री सामना
🤝 Team player|🤝 टीम प्लेयर|🤝 टीम प्लेयर`;
const I18N = { hi: {}, mr: {} };
I18.split('\n').forEach(l => { const [en, hi, mr] = l.split('|'); I18N.hi[en] = hi; I18N.mr[en] = mr; });
const MONS = { hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'], mr: ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'] };
const DAYS = { hi: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'], mr: ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'] };
const DAYSL = { hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'], mr: ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'] };
const EN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATEW = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat|AM|PM)\b/g;
function trDates(s) {
  // only short date-like labels; sentences the academy typed (notices, notes) stay exactly as written
  if (!/\d/.test(s) || /[.!?]\s|[.!?]$/.test(s) || (s.replace(DATEW, '').match(/[A-Za-z]{3,}/g) || []).length > 4) return s;
  s = s.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, w => MONS[LANG][EN_M.findIndex(m => m.startsWith(w))]);
  return s.replace(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g, w => (w.length > 3 ? DAYSL : DAYS)[LANG][EN_D.findIndex(d => d.startsWith(w))]);
}
const M_ = w => { const i = EN_M.indexOf(w); return i < 0 ? w : MONS[LANG][i]; };
const num_ = s => String(s).replace(/(st|nd|rd|th)$/, '');
// patterns for sentences that carry a name, month or number
const I18P = [
  [/^Pay (\w+) by UPI$/, (m, a) => ({ hi: `${M_(a)} की फ़ीस UPI से भरें`, mr: `${M_(a)} ची फी UPI ने भरा` })],
  [/^Pay (\w+) fee$/, (m, a) => ({ hi: `${M_(a)} की फ़ीस भरें`, mr: `${M_(a)} ची फी भरा` })],
  [/^(January|February|March|April|May|June|July|August|September|October|November|December) fee$/, (m, a) => ({ hi: `${M_(a)} की फ़ीस`, mr: `${M_(a)} ची फी` })],
  [/^(January|February|March|April|May|June|July|August|September|October|November|December) attendance$/, (m, a) => ({ hi: `${M_(a)} की हाज़िरी`, mr: `${M_(a)} ची हजेरी` })],
  [/^Due (.+)$/, (m, a) => ({ hi: `${trDates(a)} तक भरें`, mr: `${trDates(a)} पर्यंत भरा` })],
  [/^(\d+) of (\d+) sessions$/, (m, a, b) => ({ hi: `${b} में से ${a} सेशन`, mr: `${b} पैकी ${a} सेशन` })],
  [/^(.+) · (\d+) of (\d+) days$/, (m, a, b, c) => ({ hi: `${trDates(a)} · ${c} में से ${b} दिन`, mr: `${trDates(a)} · ${c} पैकी ${b} दिवस` })],
  [/^#(\d+) · (\d+)% this month$/, (m, a, b) => ({ hi: `#${a} · इस महीने ${b}%`, mr: `#${a} · या महिन्यात ${b}%` })],
  [/^(.+) · (\d+)% attendance$/, (m, a, b) => ({ hi: `${a} · ${b}% हाज़िरी`, mr: `${a} · ${b}% हजेरी` })],
  [/^Paid (.+?) · (\w+) · (R-[\d-]+)$/, (m, a, b, c) => ({ hi: `${trDates(a)} को भरा · ${b === 'Cash' ? 'नकद' : b} · ${c}`, mr: `${trDates(a)} ला भरले · ${b === 'Cash' ? 'रोख' : b} · ${c}` })],
  [/^(.+)'s tournaments and stats$/, (m, a) => ({ hi: `${a} के टूर्नामेंट और आँकड़े`, mr: `${a} च्या स्पर्धा आणि आकडे` })],
  [/^You get a notification in this app as soon as the coach marks (.+) absent or late\.$/, (m, a) => ({ hi: `कोच जैसे ही ${a} को ग़ैरहाज़िर या देर से मार्क करेंगे, आपको इस ऐप में सूचना मिलेगी।`, mr: `कोच ${a} ला गैरहजर किंवा उशिरा नोंदवताच तुम्हाला या ॲपमध्ये सूचना मिळेल.` })],
  [/^₹([\d,]+) a month · due on the (\w+) · late fee ₹([\d,]+) after the (\w+)$/, (m, a, b, c, d) => ({ hi: `₹${a} हर महीने · ${num_(b)} तारीख तक · ${num_(d)} तारीख के बाद ₹${c} लेट फ़ीस`, mr: `₹${a} दरमहा · ${num_(b)} तारखेपर्यंत · ${num_(d)} तारखेनंतर ₹${c} लेट फी` })],
  [/^Coach (.+?) · (.+)$/, (m, a, b) => ({ hi: `कोच ${a} · ${b}`, mr: `कोच ${a} · ${b}` })],
  [/^Tap when you reach (.+)\. The time is saved for the manager\.$/, (m, a) => ({ hi: `${a} पहुँचकर दबाएँ। समय मैनेजर के लिए सेव हो जाएगा।`, mr: `${a} ला पोहोचल्यावर दाबा. वेळ मॅनेजरसाठी सेव्ह होईल.` })],
  [/^(\d+) SESSIONS?$/, (m, a) => ({ hi: `${a} सेशन`, mr: `${a} सेशन` })],
  [/^(\d+) players? picked$/, (m, a) => ({ hi: `${a} खिलाड़ी चुने`, mr: `${a} खेळाडू निवडले` })],
  [/^(\d+) played$/, (m, a) => ({ hi: `${a} खेले`, mr: `${a} खेळले` })],
  [/^Receipt (R-[\d-]+)$/, (m, a) => ({ hi: `रसीद ${a}`, mr: `पावती ${a}` })],
  [/^Notifications, (\d+) new$/, (m, a) => ({ hi: `सूचनाएँ, ${a} नई`, mr: `सूचना, ${a} नवीन` })],
  [/^(\w+ \d{4}) · by (.+)$/, (m, a, b) => ({ hi: `${trDates(a)} · ${b}`, mr: `${trDates(a)} · ${b}` })],
  [/^Added (\d+ \w+)$/, (m, a) => ({ hi: `${trDates(a)} को जोड़ा`, mr: `${trDates(a)} ला जोडले` })],
  [/^Saved\. (\d+) parents? told about an absence\.$/, (m, a) => ({ hi: `सेव हो गया। ${a} पेरेंट्स को ग़ैरहाज़िरी बताई।`, mr: `सेव्ह झाले. ${a} पालकांना गैरहजेरी कळवली.` })],
  [/^The transaction ID has 12 digits\. You typed (\d+)\.$/, (m, a) => ({ hi: `ट्रांज़ैक्शन ID में 12 अंक होते हैं। आपने ${a} डाले।`, mr: `ट्रान्झॅक्शन ID मध्ये 12 अंक असतात. तुम्ही ${a} टाकले.` })],
  [/^The ID has 12 digits\. You typed (\d+)\.$/, (m, a) => ({ hi: `ID में 12 अंक होते हैं। आपने ${a} डाले।`, mr: `ID मध्ये 12 अंक असतात. तुम्ही ${a} टाकले.` })],
  [/^Being checked · ID (\d+)$/, (m, a) => ({ hi: `जाँच हो रही है · ID ${a}`, mr: `तपासणी सुरू आहे · ID ${a}` })],
  [/^Being checked · screenshot sent$/, () => ({ hi: 'जाँच हो रही है · स्क्रीनशॉट भेजा', mr: 'तपासणी सुरू आहे · स्क्रीनशॉट पाठवला' })],
  [/^Screenshot added: $/, () => ({ hi: 'स्क्रीनशॉट जोड़ा: ', mr: 'स्क्रीनशॉट जोडला: ' })],
  [/^(.+) · (\d+) players?$/, (m, a, b) => ({ hi: `${a} · ${b} खिलाड़ी`, mr: `${a} · ${b} खेळाडू` })],
  [/^(.+) parents$/, (m, a) => ({ hi: `${a} के पेरेंट्स`, mr: `${a} चे पालक` })],
  [/^(.+) · updated (.+)$/, (m, a, b) => ({ hi: `${trDates(a)} · ${trDates(b)} को बदला`, mr: `${trDates(a)} · ${trDates(b)} ला बदलले` })],
  [/^⚽ (\d+) goals?$/, (m, a) => ({ hi: `⚽ ${a} गोल`, mr: `⚽ ${a} गोल` })],
  [/^⭐ Player of the match ×(\d+)$/, (m, a) => ({ hi: `⭐ मैन ऑफ़ द मैच ×${a}`, mr: `⭐ सामनावीर ×${a}` })],
  [/^Preview as (\w+)$/, (m, a) => ({ hi: `${I18N.hi[a] || a} के रूप में देखें`, mr: `${I18N.mr[a] || a} म्हणून पाहा` })],
  [/^(\d+) waiting to send$/, (m, a) => ({ hi: `${a} भेजना बाकी`, mr: `${a} पाठवणे बाकी` })]
];
function trS(s) {
  if (LANG === 'en' || !s) return s; const t = s.trim(); if (!t) return s;
  const D = I18N[LANG]; if (D[t]) return s.replace(t, D[t]);
  for (const [re, f] of I18P) { const m = t.match(re); if (m) return s.replace(t, f(...m)[LANG]); }
  return s.replace(t, trDates(t));
}
function trDom(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest('textarea,script,style,.utr,code,.no-tr') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const list = []; let n; while ((n = w.nextNode())) list.push(n);
  list.forEach(x => { const v = trS(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; });
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e => ['placeholder', 'aria-label', 'title'].forEach(a => { const v = e.getAttribute(a); if (v) { const t = trS(v); if (t !== v) e.setAttribute(a, t); } }));
}
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-lang]')) setLang(e.target.value); });
})();
