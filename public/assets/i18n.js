// Hindi and Marathi for the guest menu, the waiter app and the admin. Only the app's own words change:
// dish names, categories and anything the restaurant typed stay as they are.
// How it works: after the page draws, every text and placeholder that matches an English line below is swapped
// for the chosen language, and new text is swapped as it appears. Lines not listed here stay in English.
(function () {
  // [English, Hindi, Marathi]. {0} and {1} stand for a number, a price or a name that is kept as it is.
  const L = [
    // ---- shared ----
    ['Menu', 'मेनू', 'मेनू'], ['Orders', 'ऑर्डर', 'ऑर्डर'], ['Order', 'ऑर्डर', 'ऑर्डर'], ['Tables', 'टेबल', 'टेबल'], ['Table', 'टेबल', 'टेबल'],
    ['Total', 'कुल', 'एकूण'], ['Add', 'जोड़ें', 'जोडा'], ['Done', 'हो गया', 'झाले'], ['Close', 'बंद करें', 'बंद करा'], ['Cancel', 'रद्द करें', 'रद्द करा'],
    ['Save', 'सेव करें', 'सेव्ह करा'], ['Save changes', 'बदलाव सेव करें', 'बदल सेव्ह करा'], ['Delete', 'हटाएँ', 'काढून टाका'], ['Edit', 'बदलें', 'बदला'], ['Change', 'बदलें', 'बदला'],
    ['Remove', 'हटाएँ', 'काढा'], ['Apply', 'लगाएँ', 'लावा'], ['Back to log in', 'लॉग इन पर वापस', 'लॉग इनवर परत'], ['Log in', 'लॉग इन', 'लॉग इन'], ['Log out', 'लॉग आउट', 'लॉग आउट'],
    ['Password', 'पासवर्ड', 'पासवर्ड'], ['Your name', 'आपका नाम', 'तुमचे नाव'], ['Mobile number', 'मोबाइल नंबर', 'मोबाईल नंबर'], ['Email', 'ईमेल', 'ईमेल'],
    ['Loading…', 'लोड हो रहा है…', 'लोड होत आहे…'], ['Sending…', 'भेज रहे हैं…', 'पाठवत आहे…'], ['Saved', 'सेव हो गया', 'सेव्ह झाले'], ['Something went wrong', 'कुछ गड़बड़ हो गई', 'काहीतरी चुकले'],
    ['Something went wrong. Please try again.', 'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।', 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.'], ['Try again', 'फिर से कोशिश करें', 'पुन्हा प्रयत्न करा'],
    ['Online', 'ऑनलाइन', 'ऑनलाइन'], ['Offline', 'ऑफ़लाइन', 'ऑफलाइन'], ['No internet.', 'इंटरनेट नहीं है।', 'इंटरनेट नाही.'], ['No internet', 'इंटरनेट नहीं है', 'इंटरनेट नाही'],
    ['Sold out', 'खत्म', 'संपले'], ['In stock', 'उपलब्ध', 'उपलब्ध'], ['Veg', 'वेज', 'व्हेज'], ['Non-veg', 'नॉन-वेज', 'नॉन-व्हेज'], ['Egg', 'अंडा', 'अंडे'],
    ['Bestseller', 'बेस्टसेलर', 'बेस्टसेलर'], ['★ Bestseller', '★ बेस्टसेलर', '★ बेस्टसेलर'], ["Chef's special", 'शेफ़ स्पेशल', 'शेफ स्पेशल'], ['New', 'नया', 'नवीन'], ['Spicy', 'तीखा', 'तिखट'],
    ['Paid', 'भुगतान हो गया', 'पैसे दिले'], ['All paid', 'पूरा भुगतान हो गया', 'सर्व पैसे दिले'], ['Still to pay', 'बाकी भुगतान', 'बाकी रक्कम'], ['Split equally', 'बराबर बाँटें', 'समान वाटा'],
    ['Split between', 'इतने लोगों में बाँटें', 'इतक्या लोकांत वाटा'], ['people', 'लोग', 'लोक'], ['each', 'हर एक', 'प्रत्येकी'], ['{0} each', '{0} हर एक', 'प्रत्येकी {0}'],
    ['Takeaway', 'पार्सल', 'पार्सल'], ['Takeaway / counter', 'पार्सल / काउंटर', 'पार्सल / काउंटर'], ['Dine-in', 'टेबल पर', 'टेबलवर'], ['Counter', 'काउंटर', 'काउंटर'],
    ['A guest', 'एक मेहमान', 'एक पाहुणे'], ['Free', 'खाली', 'रिकामे'], ['Cooking', 'बन रहा है', 'बनत आहे'], ['Food ready', 'खाना तैयार', 'जेवण तयार'], ['New order', 'नया ऑर्डर', 'नवीन ऑर्डर'],
    ['Ready', 'तैयार', 'तयार'], ['Served', 'परोसा गया', 'वाढले'], ['Preparing', 'बन रहा है', 'बनत आहे'], ['New orders', 'नए ऑर्डर', 'नवीन ऑर्डर'], ['Ready to serve', 'परोसने के लिए तैयार', 'वाढण्यासाठी तयार'],
    ['All', 'सभी', 'सर्व'], ['Note for the kitchen (optional)', 'किचन के लिए नोट (ज़रूरी नहीं)', 'किचनसाठी सूचना (ऐच्छिक)'], ['Add note', 'नोट जोड़ें', 'सूचना जोडा'],
    ['Send to kitchen', 'किचन को भेजें', 'किचनला पाठवा'], ['Sent to the kitchen', 'किचन को भेज दिया', 'किचनला पाठवले'], ['Your order', 'आपका ऑर्डर', 'तुमची ऑर्डर'],
    ['No choices', 'कोई विकल्प नहीं', 'कोणताही पर्याय नाही'], ['No dishes found', 'कोई डिश नहीं मिली', 'एकही डिश सापडली नाही'], ['Add dishes', 'डिश जोड़ें', 'डिश जोडा'],
    ['Customer name', 'ग्राहक का नाम', 'ग्राहकाचे नाव'], ['Mobile for points', 'पॉइंट्स के लिए मोबाइल', 'पॉइंट्ससाठी मोबाईल'], ['(optional)', '(ज़रूरी नहीं)', '(ऐच्छिक)'],
    ['Swiggy', 'Swiggy', 'Swiggy'], ['Zomato', 'Zomato', 'Zomato'], ['Cash', 'नकद', 'रोख'], ['UPI', 'UPI', 'UPI'], ['Card', 'कार्ड', 'कार्ड'],
    ['Help', 'मदद', 'मदत'], ['Language', 'भाषा', 'भाषा'],
    // ---- dish choices ----
    ['Pick one', 'एक चुनें', 'एक निवडा'], ['Pick any', 'कोई भी चुनें', 'कोणतेही निवडा'], ['Pick up to {0}', '{0} तक चुनें', '{0} पर्यंत निवडा'], [' · Required', ' · ज़रूरी', ' · आवश्यक'],
    ['Pick one · Required', 'एक चुनें · ज़रूरी', 'एक निवडा · आवश्यक'], ['Spice level', 'तीखापन', 'तिखटपणा'], ['Mild', 'कम तीखा', 'कमी तिखट'], ['Medium', 'मीडियम', 'मध्यम'], ['Hot', 'तीखा', 'तिखट'],
    ['Extra hot', 'बहुत तीखा', 'जास्त तिखट'], ['Jain', 'जैन', 'जैन'], ['Preparation', 'तैयारी', 'बनवण्याची पद्धत'], ['Regular', 'रेगुलर', 'नेहमीचे'], ['No onion, no garlic', 'बिना प्याज़, बिना लहसुन', 'कांदा-लसूण नाही'],
    ['Make it Jain (no onion, garlic)', 'जैन बनाएँ (बिना प्याज़, लहसुन)', 'जैन बनवा (कांदा, लसूण नाही)'], ['Portion', 'मात्रा', 'प्रमाण'], ['Full', 'फुल', 'फुल'], ['Half', 'हाफ', 'हाफ'],
    ['Pieces', 'पीस', 'नग'], ['6 pieces', '6 पीस', '6 नग'], ['12 pieces', '12 पीस', '12 नग'], ['Add-ons', 'ऐड-ऑन', 'अ‍ॅड-ऑन'], ['Extra cheese', 'एक्स्ट्रा चीज़', 'एक्स्ट्रा चीज'],
    ['Extra butter', 'एक्स्ट्रा बटर', 'एक्स्ट्रा बटर'], ['Extra paneer', 'एक्स्ट्रा पनीर', 'एक्स्ट्रा पनीर'], ['Butter naan', 'बटर नान', 'बटर नान'], ['Customisable', 'अपनी पसंद से', 'आवडीनुसार'],
    ['Add {0} · {1}', '{0} जोड़ें · {1}', '{0} जोडा · {1}'], ['Add · {0}', 'जोड़ें · {0}', 'जोडा · {0}'],
    // ---- guest menu ----
    ['My orders', 'मेरे ऑर्डर', 'माझ्या ऑर्डर'], ['Bill', 'बिल', 'बिल'], ['Call waiter', 'वेटर बुलाएँ', 'वेटरला बोलवा'], ["You're ordering for {0}", 'आप {0} के लिए ऑर्डर कर रहे हैं', 'तुम्ही {0} साठी ऑर्डर करत आहात'],
    ['Kitchen online', 'किचन ऑनलाइन है', 'किचन ऑनलाइन आहे'], ['Kitchen offline', 'किचन ऑफ़लाइन है', 'किचन ऑफलाइन आहे'],
    ["You're viewing the menu. To order, scan the QR code on your table.", 'आप मेनू देख रहे हैं। ऑर्डर करने के लिए अपनी टेबल का QR कोड स्कैन करें।', 'तुम्ही मेनू पाहत आहात. ऑर्डर करण्यासाठी तुमच्या टेबलवरचा QR कोड स्कॅन करा.'],
    ['Your phone is offline.', 'आपका फ़ोन ऑफ़लाइन है।', 'तुमचा फोन ऑफलाइन आहे.'], ['Check your internet. You can keep looking at the menu.', 'अपना इंटरनेट देखें। आप मेनू देखते रह सकते हैं।', 'इंटरनेट तपासा. तुम्ही मेनू पाहत राहू शकता.'],
    ['The kitchen is offline right now.', 'किचन अभी ऑफ़लाइन है।', 'किचन सध्या ऑफलाइन आहे.'], ['Ordering from the menu is paused. Please ask a staff member to take your order.', 'मेनू से ऑर्डर अभी रुका है। कृपया स्टाफ़ से ऑर्डर लेने को कहें।', 'मेनूमधून ऑर्डर सध्या थांबली आहे. कृपया स्टाफला ऑर्डर घ्यायला सांगा.'],
    ["We're not taking orders on the app right now. Please ask our staff.", 'अभी ऐप पर ऑर्डर नहीं ले रहे हैं। कृपया हमारे स्टाफ़ से कहें।', 'सध्या अ‍ॅपवर ऑर्डर घेत नाही. कृपया आमच्या स्टाफला सांगा.'],
    ['Ordering with friends?', 'दोस्तों के साथ ऑर्डर कर रहे हैं?', 'मित्रांसोबत ऑर्डर करताय?'],
    ['Everyone at {0} can scan the QR and add to this same order from their own phone.', '{0} पर बैठे सभी लोग QR स्कैन करके अपने फ़ोन से इसी ऑर्डर में जोड़ सकते हैं।', '{0} वरचे सगळे QR स्कॅन करून आपापल्या फोनवरून याच ऑर्डरमध्ये जोडू शकतात.'],
    ['Use code', 'कोड लगाएँ', 'कोड वापरा'], ['Veg only', 'सिर्फ़ वेज', 'फक्त व्हेज'], ['Search dishes', 'डिश खोजें', 'डिश शोधा'], ['Follow us on Instagram', 'Instagram पर फ़ॉलो करें', 'Instagram वर फॉलो करा'], ['Rate us on Google', 'Google पर रेटिंग दें', 'Google वर रेटिंग द्या'],
    ['Powered by Veyra Dine In', 'Veyra Dine In द्वारा', 'Veyra Dine In द्वारे'], ['No dishes match “{0}”.', '“{0}” से कोई डिश नहीं मिली।', '“{0}” शी जुळणारी डिश नाही.'],
    ['Scan the QR on your table to order', 'ऑर्डर करने के लिए टेबल का QR स्कैन करें', 'ऑर्डर करण्यासाठी टेबलवरचा QR स्कॅन करा'], ['Sold out for now', 'अभी खत्म है', 'सध्या संपले आहे'],
    ['View order', 'ऑर्डर देखें', 'ऑर्डर पहा'], ['{0} item · {1}', '{0} आइटम · {1}', '{0} पदार्थ · {1}'], ['{0} items · {1}', '{0} आइटम · {1}', '{0} पदार्थ · {1}'],
    ['Create account', 'अकाउंट बनाएँ', 'अकाउंट तयार करा'], ['Mobile number or email', 'मोबाइल नंबर या ईमेल', 'मोबाईल नंबर किंवा ईमेल'], ['OR', 'या', 'किंवा'],
    ['Log in to order', 'ऑर्डर के लिए लॉग इन करें', 'ऑर्डरसाठी लॉग इन करा'], ['Create your account', 'अपना अकाउंट बनाएँ', 'तुमचे अकाउंट तयार करा'], ['Log in and continue', 'लॉग इन करके आगे बढ़ें', 'लॉग इन करून पुढे चला'],
    ['Create account and continue', 'अकाउंट बनाकर आगे बढ़ें', 'अकाउंट तयार करून पुढे चला'], ["{0}'s order", '{0} का ऑर्डर', '{0} ची ऑर्डर'],
    ['Everyone at {0} adds to this order from their own phone.', '{0} पर सभी अपने फ़ोन से इस ऑर्डर में जोड़ते हैं।', '{0} वरचे सगळे आपल्या फोनवरून या ऑर्डरमध्ये जोडतात.'],
    ['Your name, so friends see what you added', 'आपका नाम, ताकि दोस्त देखें आपने क्या जोड़ा', 'तुमचे नाव, म्हणजे मित्रांना कळेल तुम्ही काय जोडले'],
    ['Mobile number for loyalty points (optional)', 'लॉयल्टी पॉइंट्स के लिए मोबाइल नंबर (ज़रूरी नहीं)', 'लॉयल्टी पॉइंट्ससाठी मोबाईल नंबर (ऐच्छिक)'],
    ['Cooking instructions (optional)', 'खाना बनाने के निर्देश (ज़रूरी नहीं)', 'स्वयंपाकासाठी सूचना (ऐच्छिक)'], ['Add more dishes', 'और डिश जोड़ें', 'आणखी डिश जोडा'],
    ['{0} applied', '{0} लग गया', '{0} लागू झाला'], ['Item total', 'आइटम का कुल', 'पदार्थांची एकूण रक्कम'], ['To pay', 'देना है', 'द्यायचे'], ['You earn', 'आपको मिलेंगे', 'तुम्हाला मिळतील'],
    ['{0} points', '{0} पॉइंट्स', '{0} पॉइंट्स'], ['You pay by UPI right after sending the order.', 'ऑर्डर भेजते ही आप UPI से भुगतान करेंगे।', 'ऑर्डर पाठवताच तुम्ही UPI ने पैसे द्याल.'],
    ['Ordering as', 'ऑर्डर कर रहे हैं', 'ऑर्डर करत आहात'], ['Not you?', 'आप नहीं हैं?', 'तुम्ही नाही?'], ['Log in with your mobile number or email to place the order.', 'ऑर्डर देने के लिए मोबाइल नंबर या ईमेल से लॉग इन करें।', 'ऑर्डर देण्यासाठी मोबाईल नंबर किंवा ईमेलने लॉग इन करा.'],
    ['Friends can still add from their phones before you send.', 'भेजने से पहले दोस्त अपने फ़ोन से और जोड़ सकते हैं।', 'पाठवण्याआधी मित्र आपल्या फोनवरून आणखी जोडू शकतात.'],
    ['Sending to kitchen…', 'किचन को भेज रहे हैं…', 'किचनला पाठवत आहे…'], ['Slow internet, still sending…', 'इंटरनेट धीमा है, भेज रहे हैं…', 'इंटरनेट हळू आहे, पाठवत आहे…'],
    ['Back to menu', 'मेनू पर वापस', 'मेनूवर परत'], ['Split the bill', 'बिल बाँटें', 'बिल वाटून घ्या'], ['All paid. Thank you for dining with us!', 'पूरा भुगतान हो गया। हमारे यहाँ खाने के लिए धन्यवाद!', 'सर्व पैसे दिले. आमच्याकडे जेवल्याबद्दल धन्यवाद!'],
    ['No orders on this table yet.', 'इस टेबल पर अभी कोई ऑर्डर नहीं है।', 'या टेबलवर अजून ऑर्डर नाही.'], ['Table total', 'टेबल का कुल', 'टेबलची एकूण रक्कम'], ['By what each person ate', 'जिसने जो खाया उसके हिसाब से', 'ज्याने जे खाल्ले त्याप्रमाणे'],
    ['Tap a dish everyone shared to split it equally between all.', 'जो डिश सबने बाँटी उस पर टैप करें, वह सबमें बराबर बँटेगी।', 'सगळ्यांनी वाटून खाल्लेल्या डिशवर टॅप करा, ती सगळ्यांत समान वाटली जाईल.'],
    ['You', 'आप', 'तुम्ही'], ['Your share', 'आपका हिस्सा', 'तुमचा वाटा'], ['Shared by the table', 'पूरी टेबल ने बाँटा', 'संपूर्ण टेबलने वाटले'], ['Share of dishes for the table', 'टेबल की डिश में हिस्सा', 'टेबलच्या डिशमधील वाटा'],
    ['Tap a person above to pay their share', 'उनका हिस्सा देने के लिए ऊपर किसी व्यक्ति पर टैप करें', 'वाटा भरण्यासाठी वर एखाद्या व्यक्तीवर टॅप करा'], ['Pay {0} with UPI', 'UPI से {0} दें', 'UPI ने {0} भरा'],
    ["I've paid {0}", 'मैंने {0} दे दिए', 'मी {0} भरले'], ["I've paid", 'मैंने भुगतान कर दिया', 'मी पैसे भरले'], ['Please pay at the counter. Show this screen to the staff.', 'कृपया काउंटर पर भुगतान करें। यह स्क्रीन स्टाफ़ को दिखाएँ।', 'कृपया काउंटरवर पैसे द्या. ही स्क्रीन स्टाफला दाखवा.'],
    ['Ask for the bill', 'बिल माँगें', 'बिल मागवा'], ['Free WiFi', 'फ़्री WiFi', 'मोफत WiFi'], ['Network', 'नेटवर्क', 'नेटवर्क'], ['Copy', 'कॉपी करें', 'कॉपी करा'], ['No password', 'कोई पासवर्ड नहीं', 'पासवर्ड नाही'],
    ['WiFi name copied', 'WiFi का नाम कॉपी हो गया', 'WiFi चे नाव कॉपी झाले'], ['Password copied', 'पासवर्ड कॉपी हो गया', 'पासवर्ड कॉपी झाला'], ['WiFi & info', 'WiFi और जानकारी', 'WiFi आणि माहिती'], ['Info', 'जानकारी', 'माहिती'],
    ['Play and win', 'खेलें और जीतें', 'खेळा आणि जिंका'], ['Top scores this week', 'इस हफ़्ते के टॉप स्कोर', 'या आठवड्याचे टॉप स्कोअर'], ['No scores yet this week. Be the first!', 'इस हफ़्ते अभी कोई स्कोर नहीं। पहले आप बनें!', 'या आठवड्यात अजून स्कोअर नाही. पहिले तुम्ही व्हा!'],
    ['Your score', 'आपका स्कोर', 'तुमचा स्कोअर'], ['Post my score', 'मेरा स्कोर डालें', 'माझा स्कोअर टाका'], ['Play again', 'फिर से खेलें', 'पुन्हा खेळा'], ['See the leaderboard', 'लीडरबोर्ड देखें', 'लीडरबोर्ड पहा'],
    ['My points', 'मेरे पॉइंट्स', 'माझे पॉइंट्स'], ['Check', 'देखें', 'तपासा'], ['points', 'पॉइंट्स', 'पॉइंट्स'], ['How can we help?', 'हम कैसे मदद करें?', 'आम्ही कशी मदत करू?'],
    ["We'll let the staff know you're at {0}.", 'हम स्टाफ़ को बता देंगे कि आप {0} पर हैं।', 'तुम्ही {0} वर आहात हे आम्ही स्टाफला कळवू.'], ['Call a waiter', 'वेटर बुलाएँ', 'वेटरला बोलवा'],
    ['Someone will come to your table', 'कोई आपकी टेबल पर आएगा', 'कोणीतरी तुमच्या टेबलवर येईल'], ["We'll bring it to your table", 'हम आपकी टेबल पर लाएँगे', 'आम्ही तुमच्या टेबलवर आणू'], ['Split the bill and pay', 'बिल बाँटें और भुगतान करें', 'बिल वाटा आणि पैसे भरा'],
    ['Each person pays their share by UPI', 'हर व्यक्ति UPI से अपना हिस्सा देता है', 'प्रत्येकजण UPI ने आपला वाटा भरतो'], ['Bring water', 'पानी लाएँ', 'पाणी आणा'], ['Still water for the table', 'टेबल के लिए सादा पानी', 'टेबलसाठी साधे पाणी'],
    ['Game Zone', 'गेम ज़ोन', 'गेम झोन'], ['Play', 'खेलें', 'खेळा'], ['See games', 'गेम देखें', 'गेम पहा'], ['The Game Zone is open', 'गेम ज़ोन खुला है', 'गेम झोन उघडा आहे'], ['Scan the QR on your table', 'अपनी टेबल का QR स्कैन करें', 'तुमच्या टेबलवरचा QR स्कॅन करा'],
    ['Order to unlock', 'खोलने के लिए ऑर्डर करें', 'उघडण्यासाठी ऑर्डर करा'], ['Order now', 'अभी ऑर्डर करें', 'आता ऑर्डर करा'], ["This week's prize", 'इस हफ़्ते का इनाम', 'या आठवड्याचे बक्षीस'], ['Locked', 'बंद', 'बंद'],
    ["This week's top scores", 'इस हफ़्ते के टॉप स्कोर', 'या आठवड्याचे टॉप स्कोअर'], ['Rewards', 'इनाम', 'बक्षिसे'], ['Offers', 'ऑफ़र', 'ऑफर'], ['Need something?', 'कुछ चाहिए?', 'काही हवे आहे?'],
    ['Someone comes to {0}', 'कोई {0} पर आएगा', 'कोणीतरी {0} वर येईल'], ['We bring it to your table', 'हम आपकी टेबल पर लाते हैं', 'आम्ही तुमच्या टेबलवर आणतो'], ['Find us', 'हमारा पता', 'आमचा पत्ता'], ['Follow and review', 'फ़ॉलो और रिव्यू करें', 'फॉलो आणि रिव्ह्यू करा'],
    ['This order was cancelled.', 'यह ऑर्डर रद्द हो गया।', 'ही ऑर्डर रद्द झाली.'], ['Payment sent', 'भुगतान भेज दिया', 'पैसे पाठवले'], ['Pay now', 'अभी भुगतान करें', 'आता पैसे भरा'],
    ['Waiting for your food? Play and win', 'खाने का इंतज़ार? खेलें और जीतें', 'जेवणाची वाट पाहताय? खेळा आणि जिंका'], ['Order more', 'और ऑर्डर करें', 'आणखी ऑर्डर करा'],
    ['Call waiter or ask for bill', 'वेटर बुलाएँ या बिल माँगें', 'वेटरला बोलवा किंवा बिल मागवा'], ['Your earlier orders', 'आपके पिछले ऑर्डर', 'तुमच्या आधीच्या ऑर्डर'], ['View', 'देखें', 'पहा'],
    ['Ready in about', 'लगभग इतने में तैयार', 'साधारण इतक्या वेळात तयार'], ['Almost there', 'बस होने वाला है', 'जवळजवळ तयार'], ['Taking a little longer than usual. The kitchen can see it.', 'आज थोड़ा ज़्यादा समय लग रहा है। किचन को पता है।', 'नेहमीपेक्षा थोडा जास्त वेळ लागत आहे. किचनला दिसत आहे.'],
    ['Menu not found', 'मेनू नहीं मिला', 'मेनू सापडला नाही'], ['No internet right now. Please check your connection and try again.', 'अभी इंटरनेट नहीं है। कनेक्शन देखकर फिर कोशिश करें।', 'सध्या इंटरनेट नाही. कनेक्शन तपासून पुन्हा प्रयत्न करा.'],
    ['Order sent', 'ऑर्डर भेज दिया', 'ऑर्डर पाठवली'], ['Order sent!', 'ऑर्डर भेज दिया!', 'ऑर्डर पाठवली!'], ['Waiting for the kitchen to accept', 'किचन के स्वीकार करने का इंतज़ार', 'किचन स्वीकारण्याची वाट पाहत आहे'],
    ['Waiting for the kitchen to accept it. This usually takes a minute.', 'किचन के स्वीकार करने का इंतज़ार। आमतौर पर एक मिनट लगता है।', 'किचन स्वीकारण्याची वाट पाहत आहे. साधारण एक मिनिट लागतो.'],
    ['Being prepared', 'बन रहा है', 'बनत आहे'], ['Our chefs are cooking', 'हमारे शेफ़ बना रहे हैं', 'आमचे शेफ बनवत आहेत'], ['Coming to your table', 'आपकी टेबल पर आ रहा है', 'तुमच्या टेबलवर येत आहे'],
    ['Enjoy your meal!', 'खाने का आनंद लें!', 'जेवणाचा आनंद घ्या!'], ['Order cancelled', 'ऑर्डर रद्द', 'ऑर्डर रद्द'], ['Please speak to our staff if this is a mistake.', 'अगर यह गलती है तो कृपया स्टाफ़ से बात करें।', 'ही चूक असल्यास कृपया स्टाफशी बोला.'],
    ['Your order has been served.', 'आपका ऑर्डर परोस दिया गया है।', 'तुमची ऑर्डर वाढली आहे.'], ['Your food is ready', 'आपका खाना तैयार है', 'तुमचे जेवण तयार आहे'], ['It is on its way to your table.', 'यह आपकी टेबल पर आ रहा है।', 'ते तुमच्या टेबलकडे येत आहे.'],
    ['Accepted · being prepared', 'स्वीकार हुआ · बन रहा है', 'स्वीकारली · बनत आहे'], ['The kitchen has accepted your order and started on it.', 'किचन ने आपका ऑर्डर ले लिया है और बनाना शुरू कर दिया है।', 'किचनने तुमची ऑर्डर घेतली आहे आणि बनवायला सुरुवात केली आहे.'],
    ['Note: {0}', 'नोट: {0}', 'सूचना: {0}'], ['Coupon {0}', 'कूपन {0}', 'कूपन {0}'],
    // ---- waiter app ----
    ['Waiter', 'वेटर', 'वेटर'], ['Log in to take orders', 'ऑर्डर लेने के लिए लॉग इन करें', 'ऑर्डर घेण्यासाठी लॉग इन करा'],
    ["Your restaurant admin gives you the restaurant ID and the waiter PIN. Ask them if you don't have them yet.", 'रेस्टोरेंट ID और वेटर PIN आपके मालिक देंगे। अगर नहीं हैं तो उनसे पूछें।', 'रेस्टॉरंट ID आणि वेटर PIN तुमचे मालक देतील. नसल्यास त्यांना विचारा.'],
    ['Restaurant ID', 'रेस्टोरेंट ID', 'रेस्टॉरंट ID'], ['Waiter PIN', 'वेटर PIN', 'वेटर PIN'], ['Sound on', 'आवाज़ चालू', 'आवाज चालू'], ['Sound off', 'आवाज़ बंद', 'आवाज बंद'],
    ['You can still take orders. They are saved on this phone and go to the kitchen when the internet is back.', 'आप फिर भी ऑर्डर ले सकते हैं। ये इस फ़ोन में सेव रहेंगे और इंटरनेट आते ही किचन जाएँगे।', 'तुम्ही तरीही ऑर्डर घेऊ शकता. त्या या फोनवर सेव्ह राहतील आणि इंटरनेट आल्यावर किचनला जातील.'],
    ['Sending now…', 'अभी भेज रहे हैं…', 'आता पाठवत आहे…'], ['Tell the kitchen by voice if it is urgent.', 'ज़रूरी हो तो किचन को बोलकर बताएँ।', 'तातडीचे असल्यास किचनला तोंडी सांगा.'],
    ['{0} of {1} busy', '{1} में से {0} भरी', '{1} पैकी {0} भरलेले'], ['To accept', 'स्वीकार करना है', 'स्वीकारायची'], ['No tables yet. The owner adds them in Tables & QR.', 'अभी कोई टेबल नहीं। मालिक इन्हें Tables & QR में जोड़ते हैं।', 'अजून टेबल नाहीत. मालक त्या Tables & QR मध्ये जोडतात.'],
    ['Takeaway or counter order', 'पार्सल या काउंटर ऑर्डर', 'पार्सल किंवा काउंटर ऑर्डर'], ['Accept', 'स्वीकार करें', 'स्वीकारा'], ['No open orders right now.', 'अभी कोई खुला ऑर्डर नहीं है।', 'सध्या एकही उघडी ऑर्डर नाही.'],
    ['Calls from tables', 'टेबल से बुलावा', 'टेबलवरून बोलावणे'], ['Calls', 'बुलावा', 'बोलावणे'],
    ['No calls. When a guest taps "Call waiter" or "Ask for bill", it shows here with a sound.', 'कोई बुलावा नहीं। जब मेहमान "वेटर बुलाएँ" या "बिल माँगें" दबाते हैं, यहाँ आवाज़ के साथ दिखता है।', 'बोलावणे नाही. पाहुण्यांनी "वेटरला बोलवा" किंवा "बिल मागवा" दाबले की इथे आवाजासह दिसते.'],
    ['Table total so far', 'अब तक टेबल का कुल', 'आतापर्यंत टेबलची एकूण रक्कम'], ['No orders at this table yet.', 'इस टेबल पर अभी कोई ऑर्डर नहीं।', 'या टेबलवर अजून ऑर्डर नाही.'], ['Take order for {0}', '{0} का ऑर्डर लें', '{0} ची ऑर्डर घ्या'],
    ['More', 'और', 'आणखी'], ['No dish matches.', 'कोई डिश नहीं मिली।', 'जुळणारी डिश नाही.'], ['Marked served', 'परोसा गया मार्क किया', 'वाढले म्हणून नोंदवले'],
    ['Guest orders from the QR. Accept sends them to the kitchen.', 'QR से मेहमानों के ऑर्डर। स्वीकार करने पर किचन जाते हैं।', 'QR वरून पाहुण्यांच्या ऑर्डर. स्वीकारल्यावर किचनला जातात.'],
    ['No internet. Check the WiFi or mobile data.', 'इंटरनेट नहीं है। WiFi या मोबाइल डेटा देखें।', 'इंटरनेट नाही. WiFi किंवा मोबाईल डेटा तपासा.'], ['{0} · has choices', '{0} · विकल्प हैं', '{0} · पर्याय आहेत'],
    // ---- admin ----
    ['Live orders', 'लाइव ऑर्डर', 'लाइव्ह ऑर्डर'], ['Sales by date', 'तारीख से बिक्री', 'तारखेनुसार विक्री'], ['Coupons', 'कूपन', 'कूपन'], ['Tables & QR', 'टेबल और QR', 'टेबल आणि QR'],
    ['Branding', 'ब्रांडिंग', 'ब्रँडिंग'], ['Settings', 'सेटिंग्स', 'सेटिंग्ज'], ['Admin panel', 'एडमिन पैनल', 'अ‍ॅडमिन पॅनल'], ['View customer menu', 'ग्राहक मेनू देखें', 'ग्राहक मेनू पहा'],
    ['Take order', 'ऑर्डर लें', 'ऑर्डर घ्या'], ['Take an order', 'ऑर्डर लें', 'ऑर्डर घ्या'], ['Taking orders', 'ऑर्डर ले रहे हैं', 'ऑर्डर घेत आहोत'], ['Orders paused', 'ऑर्डर रुके हैं', 'ऑर्डर थांबल्या'],
    ['Sound alerts on', 'आवाज़ अलर्ट चालू', 'आवाज अलर्ट चालू'], ['Sound alerts off', 'आवाज़ अलर्ट बंद', 'आवाज अलर्ट बंद'], ['Customers can order again', 'ग्राहक फिर से ऑर्डर कर सकते हैं', 'ग्राहक पुन्हा ऑर्डर करू शकतात'],
    ['Ordering paused. Customers can still see the menu.', 'ऑर्डर रुके हैं। ग्राहक मेनू देख सकते हैं।', 'ऑर्डर थांबल्या आहेत. ग्राहकांना मेनू दिसतो.'],
    ['Orders today', 'आज के ऑर्डर', 'आजच्या ऑर्डर'], ['Other days ›', 'दूसरे दिन ›', 'इतर दिवस ›'], ['Sales today', 'आज की बिक्री', 'आजची विक्री'], ['Orders in progress', 'चल रहे ऑर्डर', 'सुरू असलेल्या ऑर्डर'],
    ['Tables ordering now', 'अभी ऑर्डर कर रही टेबल', 'आता ऑर्डर करणारी टेबल'], ['Open bill', 'बिल खोलें', 'बिल उघडा'], ['Due in {0} min', '{0} मिनट में देना है', '{0} मिनिटांत द्यायचे'], ['Late by {0} min', '{0} मिनट देर', '{0} मिनिटे उशीर'],
    ['Saved offline', 'ऑफ़लाइन सेव', 'ऑफलाइन सेव्ह'], ['KOT', 'KOT', 'KOT'], ['From', 'से', 'पासून'], ['Accept & start cooking', 'स्वीकार करें और बनाना शुरू करें', 'स्वीकारा आणि बनवायला सुरू करा'],
    ['Mark as ready', 'तैयार मार्क करें', 'तयार म्हणून नोंदवा'], ['Mark as served', 'परोसा गया मार्क करें', 'वाढले म्हणून नोंदवा'], ['Packed, ready for rider', 'पैक हो गया, राइडर के लिए तैयार', 'पॅक झाले, रायडरसाठी तयार'],
    ['Picked up by rider', 'राइडर ले गया', 'रायडरने नेले'], ['Delivery', 'डिलीवरी', 'डिलिव्हरी'], ['Taken by staff', 'स्टाफ़ ने लिया', 'स्टाफने घेतले'], ['Counter order', 'काउंटर ऑर्डर', 'काउंटर ऑर्डर'],
    ['Cancel this order?', 'यह ऑर्डर रद्द करें?', 'ही ऑर्डर रद्द करायची?'], ['The customer will see that the order was cancelled.', 'ग्राहक देखेगा कि ऑर्डर रद्द हुआ।', 'ऑर्डर रद्द झाल्याचे ग्राहकाला दिसेल.'], ['Cancel order', 'ऑर्डर रद्द करें', 'ऑर्डर रद्द करा'],
    ['No new orders yet.', 'अभी कोई नया ऑर्डर नहीं।', 'अजून नवीन ऑर्डर नाही.'], ['Waiting for orders. New ones pop up here with a sound.', 'ऑर्डर का इंतज़ार। नए ऑर्डर आवाज़ के साथ यहाँ दिखेंगे।', 'ऑर्डरची वाट पाहत आहे. नवीन ऑर्डर आवाजासह इथे दिसतील.'],
    ['Nothing here right now.', 'अभी यहाँ कुछ नहीं।', 'सध्या इथे काही नाही.'], ['Turn on alerts', 'अलर्ट चालू करें', 'अलर्ट चालू करा'], ['Alerts are on. Keep this page open.', 'अलर्ट चालू हैं। यह पेज खुला रखें।', 'अलर्ट चालू आहेत. हे पेज उघडे ठेवा.'],
    ['Turn on alerts so you hear a sound and get a pop-up for every new order.', 'अलर्ट चालू करें ताकि हर नए ऑर्डर पर आवाज़ और पॉप-अप आए।', 'अलर्ट चालू करा म्हणजे प्रत्येक नवीन ऑर्डरला आवाज आणि पॉप-अप येईल.'],
    ['Kitchen display', 'किचन डिस्प्ले', 'किचन डिस्प्ले'], ['Customer display', 'ग्राहक डिस्प्ले', 'ग्राहक डिस्प्ले'], ['QR orders go straight to the kitchen.', 'QR ऑर्डर सीधे किचन जाते हैं।', 'QR ऑर्डर थेट किचनला जातात.'],
    ['Pick the table. {0} of {1} busy.', 'टेबल चुनें। {1} में से {0} भरी।', 'टेबल निवडा. {1} पैकी {0} भरलेले.'], ['Takeaway or counter', 'पार्सल या काउंटर', 'पार्सल किंवा काउंटर'],
    ['Parcel, phone order or walk-in at the counter', 'पार्सल, फ़ोन ऑर्डर या काउंटर पर आए ग्राहक', 'पार्सल, फोन ऑर्डर किंवा काउंटरवर आलेले ग्राहक'], ['Already ordered here:', 'यहाँ पहले से ऑर्डर:', 'इथे आधीच ऑर्डर:'],
    ['No dishes yet', 'अभी कोई डिश नहीं', 'अजून डिश नाही'], ['No tables yet. Add them in Tables & QR, or take a counter order.', 'अभी कोई टेबल नहीं। Tables & QR में जोड़ें, या काउंटर ऑर्डर लें।', 'अजून टेबल नाहीत. Tables & QR मध्ये जोडा किंवा काउंटर ऑर्डर घ्या.'],
    ['Sales', 'बिक्री', 'विक्री'], ['Average order', 'औसत ऑर्डर', 'सरासरी ऑर्डर'], ['Where orders came from', 'ऑर्डर कहाँ से आए', 'ऑर्डर कुठून आल्या'], ['Type', 'प्रकार', 'प्रकार'], ['Commission', 'कमीशन', 'कमिशन'],
    ['Sales by day', 'दिन के हिसाब से बिक्री', 'दिवसानुसार विक्री'], ['Click a day to open it', 'खोलने के लिए दिन पर क्लिक करें', 'उघडण्यासाठी दिवसावर क्लिक करा'], ['By table', 'टेबल के हिसाब से', 'टेबलनुसार'],
    ['Download (Excel)', 'डाउनलोड (Excel)', 'डाउनलोड (Excel)'], ['Items', 'आइटम', 'पदार्थ'], ['Print', 'प्रिंट', 'प्रिंट'], ['What sells', 'क्या बिकता है', 'काय विकले जाते'], ['By category', 'कैटेगरी के हिसाब से', 'कॅटेगरीनुसार'],
    ['Show all', 'सब दिखाएँ', 'सर्व दाखवा'], ['By sales', 'बिक्री से', 'विक्रीनुसार'], ['By quantity', 'मात्रा से', 'संख्येनुसार'], ['Dish', 'डिश', 'डिश'], ['Category', 'कैटेगरी', 'कॅटेगरी'], ['Sold', 'बिका', 'विकले'],
    ['Today', 'आज', 'आज'], ['Yesterday', 'कल', 'काल'], ['Last 7 days', 'पिछले 7 दिन', 'मागील 7 दिवस'], ['Last 30 days', 'पिछले 30 दिन', 'मागील 30 दिवस'], ['This month', 'इस महीने', 'हा महिना'], ['Last month', 'पिछला महीना', 'मागील महिना'],
    ['Busiest hour', 'सबसे व्यस्त घंटा', 'सर्वात गर्दीचा तास'], ['Best day', 'सबसे अच्छा दिन', 'सर्वोत्तम दिवस'], ['Date', 'तारीख', 'तारीख'], ['Time', 'समय', 'वेळ'],
    ['Loading menu…', 'मेनू लोड हो रहा है…', 'मेनू लोड होत आहे…'], ['Categories', 'कैटेगरी', 'कॅटेगरी'], ['Import', 'इम्पोर्ट', 'इम्पोर्ट'], ['Add dish', 'डिश जोड़ें', 'डिश जोडा'], ['Add a dish', 'डिश जोड़ें', 'डिश जोडा'],
    ['Edit dish', 'डिश बदलें', 'डिश बदला'], ['No dishes here yet.', 'यहाँ अभी कोई डिश नहीं।', 'इथे अजून डिश नाही.'], ['Add your first dish', 'अपनी पहली डिश जोड़ें', 'तुमची पहिली डिश जोडा'], ['Category name', 'कैटेगरी का नाम', 'कॅटेगरीचे नाव'],
    ['Add a photo', 'फ़ोटो जोड़ें', 'फोटो जोडा'], ['Dishes with photos sell better', 'फ़ोटो वाली डिश ज़्यादा बिकती हैं', 'फोटो असलेल्या डिश जास्त विकल्या जातात'], ['Dish name', 'डिश का नाम', 'डिशचे नाव'],
    ['Description (optional)', 'विवरण (ज़रूरी नहीं)', 'वर्णन (ऐच्छिक)'], ['In stock (customers can order it)', 'उपलब्ध (ग्राहक ऑर्डर कर सकते हैं)', 'उपलब्ध (ग्राहक ऑर्डर करू शकतात)'],
    ['Choices for this dish', 'इस डिश के विकल्प', 'या डिशचे पर्याय'], ['Add choice', 'विकल्प जोड़ें', 'पर्याय जोडा'], ['Your own', 'अपना खुद का', 'स्वतःचा'], ['Jain / no onion-garlic', 'जैन / बिना प्याज़-लहसुन', 'जैन / कांदा-लसूण नाही'],
    ['Half / Full', 'हाफ / फुल', 'हाफ / फुल'], ['New category', 'नई कैटेगरी', 'नवीन कॅटेगरी'], ['Add category', 'कैटेगरी जोड़ें', 'कॅटेगरी जोडा'], ['Rename category', 'कैटेगरी का नाम बदलें', 'कॅटेगरीचे नाव बदला'],
    ['Loading tables…', 'टेबल लोड हो रही हैं…', 'टेबल लोड होत आहेत…'], ['Each table has its own QR code. Orders show the table number.', 'हर टेबल का अपना QR कोड है। ऑर्डर में टेबल नंबर दिखता है।', 'प्रत्येक टेबलचा स्वतःचा QR कोड आहे. ऑर्डरमध्ये टेबल नंबर दिसतो.'],
    ['Add several', 'कई जोड़ें', 'अनेक जोडा'], ['Add table', 'टेबल जोड़ें', 'टेबल जोडा'], ['Print all QR cards', 'सारे QR कार्ड प्रिंट करें', 'सर्व QR कार्ड प्रिंट करा'], ['● Ordering now', '● अभी ऑर्डर कर रहे हैं', '● आता ऑर्डर करत आहेत'],
    ['Copy link', 'लिंक कॉपी करें', 'लिंक कॉपी करा'], ['Options', 'विकल्प', 'पर्याय'], ['Bill and split', 'बिल और बँटवारा', 'बिल आणि वाटणी'], ['Table name', 'टेबल का नाम', 'टेबलचे नाव'],
    ['Print bill', 'बिल प्रिंट करें', 'बिल प्रिंट करा'], ['One payment', 'एक भुगतान', 'एकच पेमेंट'], ['Whole table', 'पूरी टेबल', 'संपूर्ण टेबल'], ['By what each ate', 'जिसने जो खाया', 'ज्याने जे खाल्ले'],
    ['No open bill on this table.', 'इस टेबल पर कोई खुला बिल नहीं।', 'या टेबलवर उघडे बिल नाही.'], ['Clear table', 'टेबल खाली करें', 'टेबल रिकामे करा'], ['Done, clear table', 'हो गया, टेबल खाली करें', 'झाले, टेबल रिकामे करा'],
    ['Clear table anyway', 'फिर भी टेबल खाली करें', 'तरीही टेबल रिकामे करा'], ['Clear table with money still due?', 'पैसे बाकी हैं, फिर भी टेबल खाली करें?', 'पैसे बाकी असताना टेबल रिकामे करायचे?'], ['Balance due', 'बाकी रकम', 'बाकी रक्कम'], ['Fully paid', 'पूरा भुगतान', 'पूर्ण भरले'],
    ['Logo & photos', 'लोगो और फ़ोटो', 'लोगो आणि फोटो'], ['Name & colour', 'नाम और रंग', 'नाव आणि रंग'], ['Social media & links', 'सोशल मीडिया और लिंक', 'सोशल मीडिया आणि लिंक'], ['Save branding', 'ब्रांडिंग सेव करें', 'ब्रँडिंग सेव्ह करा'],
    ['Live preview', 'लाइव प्रीव्यू', 'लाइव्ह प्रिव्ह्यू'], ['Plan and license', 'प्लान और लाइसेंस', 'प्लॅन आणि लायसन्स'], ['Waiters', 'वेटर', 'वेटर'], ['Your restaurant', 'आपका रेस्टोरेंट', 'तुमचे रेस्टॉरंट'],
    ['Bill printer', 'बिल प्रिंटर', 'बिल प्रिंटर'], ['Change password', 'पासवर्ड बदलें', 'पासवर्ड बदला'], ['Loyalty points', 'लॉयल्टी पॉइंट्स', 'लॉयल्टी पॉइंट्स'], ['Games for guests', 'मेहमानों के लिए गेम', 'पाहुण्यांसाठी गेम'],
    ['WiFi for guests', 'मेहमानों के लिए WiFi', 'पाहुण्यांसाठी WiFi'], ['Guest log in', 'मेहमान लॉग इन', 'पाहुणे लॉग इन'], ['Split bill and UPI payments', 'बिल बँटवारा और UPI भुगतान', 'बिल वाटणी आणि UPI पेमेंट'],
    ['Swiggy and Zomato orders', 'Swiggy और Zomato ऑर्डर', 'Swiggy आणि Zomato ऑर्डर'], ['Orders without a waiter', 'बिना वेटर के ऑर्डर', 'वेटरशिवाय ऑर्डर'], ['Kitchen display (KDS)', 'किचन डिस्प्ले (KDS)', 'किचन डिस्प्ले (KDS)'],
    ['Counter display (customer screen)', 'काउंटर डिस्प्ले (ग्राहक स्क्रीन)', 'काउंटर डिस्प्ले (ग्राहक स्क्रीन)'], ['WiFi backup (no internet)', 'WiFi बैकअप (बिना इंटरनेट)', 'WiFi बॅकअप (इंटरनेटशिवाय)'],
    ['Customers', 'ग्राहक', 'ग्राहक'], ['Customer', 'ग्राहक', 'ग्राहक'], ['Points', 'पॉइंट्स', 'पॉइंट्स'], ['Visits', 'विज़िट', 'भेटी'], ['Spent', 'खर्च', 'खर्च'], ['Name', 'नाम', 'नाव'], ['Mobile', 'मोबाइल', 'मोबाईल'],
    ['Coupon codes', 'कूपन कोड', 'कूपन कोड'], ['New coupon', 'नया कूपन', 'नवीन कूपन'], ['Code', 'कोड', 'कोड'], ['Discount', 'छूट', 'सूट'], ['Used', 'इस्तेमाल', 'वापरले'], ['Valid till', 'कब तक मान्य', 'कधीपर्यंत वैध'],
    ['Shown on menu', 'मेनू पर दिखता है', 'मेनूवर दिसते'], ['Active', 'चालू', 'चालू'], ['Expired', 'खत्म हो गया', 'संपले'], ['Create coupon', 'कूपन बनाएँ', 'कूपन तयार करा'],
    ['Welcome back', 'वापसी पर स्वागत है', 'पुन्हा स्वागत आहे'], ['Log in to see your live orders.', 'अपने लाइव ऑर्डर देखने के लिए लॉग इन करें।', 'तुमच्या लाइव्ह ऑर्डर पाहण्यासाठी लॉग इन करा.'],
    ['Forgot your password?', 'पासवर्ड भूल गए?', 'पासवर्ड विसरलात?'], ['Continue with Google', 'Google से आगे बढ़ें', 'Google ने पुढे चला'], ['Email or restaurant ID', 'ईमेल या रेस्टोरेंट ID', 'ईमेल किंवा रेस्टॉरंट ID'],
    ['Start free trial', 'फ़्री ट्रायल शुरू करें', 'मोफत ट्रायल सुरू करा'], ['Just now', 'अभी', 'आत्ताच'], ['Link copied', 'लिंक कॉपी हो गया', 'लिंक कॉपी झाली'], ['Please log in', 'कृपया लॉग इन करें', 'कृपया लॉग इन करा'],
    ['Connected. New orders arrive here live, and guests see "Kitchen online".', 'कनेक्ट है। नए ऑर्डर यहाँ लाइव आते हैं, और मेहमानों को "किचन ऑनलाइन है" दिखता है।', 'कनेक्ट आहे. नवीन ऑर्डर इथे लाइव्ह येतात आणि पाहुण्यांना "किचन ऑनलाइन आहे" दिसते.'],
    ['Not connected. Guests see "Kitchen offline". Orders they send will show here when you are back online.', 'कनेक्ट नहीं है। मेहमानों को "किचन ऑफ़लाइन है" दिखता है। ऑनलाइन आते ही उनके ऑर्डर यहाँ दिखेंगे।', 'कनेक्ट नाही. पाहुण्यांना "किचन ऑफलाइन आहे" दिसते. ऑनलाइन आल्यावर त्यांच्या ऑर्डर इथे दिसतील.'],
    ['Pick one, must choose', 'एक चुनें, ज़रूरी', 'एक निवडा, आवश्यक'], ['Pick one, optional', 'एक चुनें, ज़रूरी नहीं', 'एक निवडा, ऐच्छिक'], ['Pick any (add-ons)', 'कोई भी चुनें (ऐड-ऑन)', 'कोणतेही निवडा (अ‍ॅड-ऑन)'],
    ['Not food / skip', 'खाना नहीं / छोड़ें', 'जेवण नाही / वगळा'], ['Swiggy and Zomato prices', 'Swiggy और Zomato कीमत', 'Swiggy आणि Zomato किंमत'], ['Swiggy price', 'Swiggy कीमत', 'Swiggy किंमत'], ['Zomato price', 'Zomato कीमत', 'Zomato किंमत'],
    ['{0} min ago', '{0} मिनट पहले', '{0} मिनिटांपूर्वी'], ['Order #{0} · {1}', 'ऑर्डर #{0} · {1}', 'ऑर्डर #{0} · {1}'], ['Order #{0}', 'ऑर्डर #{0}', 'ऑर्डर #{0}'],
    ['is calling a waiter', 'वेटर को बुला रहे हैं', 'वेटरला बोलावत आहेत'], ['asked for the bill', 'ने बिल माँगा', 'यांनी बिल मागितले'], ['asked for water', 'ने पानी माँगा', 'यांनी पाणी मागितले'],
    ['Take an order for a table, the counter or a phone call.', 'टेबल, काउंटर या फ़ोन कॉल का ऑर्डर लें।', 'टेबल, काउंटर किंवा फोन कॉलची ऑर्डर घ्या.'],
    ['Use this as an app.', 'इसे ऐप की तरह इस्तेमाल करें।', 'हे अ‍ॅपसारखे वापरा.'], ['Put Dine In Admin on your home screen and open it in one tap.', 'Dine In Admin को होम स्क्रीन पर रखें और एक टैप में खोलें।', 'Dine In Admin होम स्क्रीनवर ठेवा आणि एका टॅपमध्ये उघडा.'],
    ['How', 'कैसे', 'कसे'], ['Install', 'इंस्टॉल करें', 'इंस्टॉल करा'], ['Top scorer this week wins {0}', 'इस हफ़्ते टॉप स्कोरर जीतेगा {0}', 'या आठवड्याचा टॉप स्कोअरर जिंकेल {0}'],
    ['Three quick games to play while your food is being made. Free to play, and the best score each week wins.', 'खाना बनने तक खेलने के लिए तीन छोटे गेम। खेलना फ़्री है, और हर हफ़्ते सबसे अच्छा स्कोर जीतता है।', 'जेवण तयार होईपर्यंत खेळण्यासाठी तीन छोटे गेम. खेळणे मोफत आहे आणि दर आठवड्याला सर्वोत्तम स्कोअर जिंकतो.'],
    ['Then order, and the Game Zone opens while your food is being made.', 'फिर ऑर्डर करें, खाना बनने तक गेम ज़ोन खुला रहेगा।', 'मग ऑर्डर करा, जेवण तयार होईपर्यंत गेम झोन उघडा राहील.'],
    ['Place your order and the games open right away. Play as often as you like until your food is ready.', 'ऑर्डर दें और गेम तुरंत खुल जाएँगे। खाना आने तक जितना चाहें खेलें।', 'ऑर्डर द्या आणि गेम लगेच उघडतील. जेवण येईपर्यंत हवे तितके खेळा.'],
    ["Send everyone's order · {0}", 'सबका ऑर्डर भेजें · {0}', 'सगळ्यांची ऑर्डर पाठवा · {0}'], ['Send order to kitchen · {0}', 'किचन को ऑर्डर भेजें · {0}', 'किचनला ऑर्डर पाठवा · {0}'],
    ['Log in to send order · {0}', 'ऑर्डर भेजने के लिए लॉग इन करें · {0}', 'ऑर्डर पाठवण्यासाठी लॉग इन करा · {0}'], ['{0} · {1} people adding', '{0} · {1} लोग जोड़ रहे हैं', '{0} · {1} जण जोडत आहेत'],
    // ---- help ----
    ['Help and support', 'मदद और सपोर्ट', 'मदत आणि सपोर्ट'], ['Email us', 'हमें ईमेल करें', 'आम्हाला ईमेल करा'],
    ['We reply within 2 hours, 10 AM to 7 PM, Monday to Saturday.', 'हम सोमवार से शनिवार, सुबह 10 से शाम 7 बजे तक, 2 घंटे में जवाब देते हैं।', 'आम्ही सोमवार ते शनिवार, सकाळी 10 ते संध्याकाळी 7, 2 तासांत उत्तर देतो.'],
    ['Free setup visit', 'फ़्री सेटअप विज़िट', 'मोफत सेटअप भेट'], ['Restaurants in Navi Mumbai and Thane get a free visit: we add your menu, set up the printer and train your staff.', 'नवी मुंबई और ठाणे के रेस्टोरेंट के लिए फ़्री विज़िट: हम आपका मेनू डालेंगे, प्रिंटर लगाएँगे और स्टाफ़ को सिखाएँगे।', 'नवी मुंबई आणि ठाण्यातील रेस्टॉरंटसाठी मोफत भेट: आम्ही तुमचा मेनू टाकू, प्रिंटर लावू आणि स्टाफला शिकवू.'],
    ['Ask for a visit', 'विज़िट माँगें', 'भेट मागवा'], ['How-to guides', 'कैसे करें गाइड', 'कसे करावे मार्गदर्शक'], ['Step-by-step guides for every main feature.', 'हर मुख्य फ़ीचर के लिए आसान गाइड।', 'प्रत्येक मुख्य फीचरसाठी सोपे मार्गदर्शक.'],
    ['Open guides', 'गाइड खोलें', 'मार्गदर्शक उघडा'], ['Waiter app help', 'वेटर ऐप मदद', 'वेटर अ‍ॅप मदत'],
    ['Tap a table to see its orders and calls. Tap Take order to add dishes. Accept sends guest QR orders to the kitchen. Tap Served when food reaches the table.', 'टेबल पर टैप करके उसके ऑर्डर और बुलावे देखें। डिश जोड़ने के लिए "ऑर्डर लें" दबाएँ। "स्वीकार करें" से QR ऑर्डर किचन जाते हैं। खाना टेबल पर पहुँचे तो "परोसा गया" दबाएँ।', 'टेबलवर टॅप करून त्याच्या ऑर्डर आणि बोलावणे पहा. डिश जोडण्यासाठी "ऑर्डर घ्या" दाबा. "स्वीकारा" ने QR ऑर्डर किचनला जातात. जेवण टेबलवर पोहोचले की "वाढले" दाबा.'],
    ['Problem with the app? Ask the owner, or email us.', 'ऐप में दिक्कत? मालिक से पूछें, या हमें ईमेल करें।', 'अ‍ॅपमध्ये अडचण? मालकाला विचारा किंवा आम्हाला ईमेल करा.'],
    ['This is the demo, so changes are turned off. Start your free trial to set up your own restaurant.', 'यह डेमो है, इसलिए बदलाव बंद हैं। अपना रेस्टोरेंट सेट करने के लिए फ़्री ट्रायल शुरू करें।', 'हा डेमो आहे, त्यामुळे बदल बंद आहेत. तुमचे रेस्टॉरंट सेट करण्यासाठी मोफत ट्रायल सुरू करा.'],
    ['Demo restaurant: view only. Orders here are not real.', 'डेमो रेस्टोरेंट: सिर्फ़ देखने के लिए। यहाँ के ऑर्डर असली नहीं हैं।', 'डेमो रेस्टॉरंट: फक्त पाहण्यासाठी. इथल्या ऑर्डर खऱ्या नाहीत.'], ['Start your free trial', 'अपना फ़्री ट्रायल शुरू करें', 'तुमचा मोफत ट्रायल सुरू करा'],
  ];
  const LANGS = [['en', 'English'], ['hi', 'हिंदी'], ['mr', 'मराठी']];
  const exact = { hi: new Map(), mr: new Map() }, pats = { hi: [], mr: [] };
  const reEsc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  for (const [en, hi, mr] of L) {
    for (const [k, v] of [['hi', hi], ['mr', mr]]) {
      if (/\{\d\}/.test(en)) pats[k].push([new RegExp('^' + reEsc(en).replace(/\\?\{(\d)\\?\}/g, '(.+?)') + '$'), v]);
      else exact[k].set(en, v);
    }
  }
  let lang = 'en';
  try { lang = localStorage.getItem('vd_lang') || 'en'; } catch (e) {}
  if (!exact[lang]) lang = 'en';
  function tx(s) {
    if (lang === 'en' || !s) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    if (!core || !/[A-Za-z]/.test(core)) return s;
    let out = exact[lang].get(core);
    if (out == null) for (const [re, v] of pats[lang]) { const g = re.exec(core); if (g) { out = v.replace(/\{(\d)\}/g, (_, i) => { const x = g[+i + 1]; return exact[lang].get(x) || x; }); break; } }
    return out == null ? s : m[1] + out + m[3];
  }
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|CODE|NOSCRIPT|SVG|svg)$/;
  const skip = el => { for (let e = el; e && e.nodeType === 1; e = e.parentNode) { if (SKIP.test(e.nodeName) || e.isContentEditable || e.getAttribute('translate') === 'no') return true; } return false; };
  const texts = new WeakMap(), attrs = new WeakMap(), ATTRS = ['placeholder', 'title', 'aria-label'];
  function doText(n) {
    const v = n.nodeValue, r = texts.get(n);
    if (!r && !/[A-Za-z]/.test(v)) return;
    const en = r && r.out === v ? r.en : v, out = tx(en);
    if (out !== v) n.nodeValue = out;
    if (out !== en) texts.set(n, { en, out }); else texts.delete(n);
  }
  function doAttrs(el) {
    let rec = attrs.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a), r = rec && rec[a];
      const en = r && r.out === v ? r.en : v, out = tx(en);
      if (out !== v) el.setAttribute(a, out);
      if (out !== en) { rec = rec || {}; rec[a] = { en, out }; attrs.set(el, rec); } else if (rec) delete rec[a];
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !skip(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => n.nodeType === 1 && (SKIP.test(n.nodeName) || n.getAttribute('translate') === 'no') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  let obs = null;
  function watch() {
    if (obs || !document.body) return;
    obs = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') { if (!skip(m.target.parentNode)) doText(m.target); }
        else if (m.type === 'attributes') { if (!skip(m.target)) doAttrs(m.target); }
        else m.addedNodes.forEach(walk);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    walk(document.body);
  }
  function set(l) {
    if (!exact[l] && l !== 'en') l = 'en';
    lang = l; try { localStorage.setItem('vd_lang', l); } catch (e) {}
    document.documentElement.lang = l === 'en' ? 'en' : l;
    document.querySelectorAll('select.vd-lang').forEach(s => { s.value = l; });
    if (document.body) walk(document.body);
  }
  // a small language picker: <select class="vd-lang">. It is never translated itself.
  function picker(extra) {
    return `<label class="vd-lang-w ${extra || ''}" translate="no"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><select class="vd-lang" aria-label="Language / भाषा">${LANGS.map(([k, n]) => `<option value="${k}" ${k === lang ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
  }
  document.addEventListener('change', e => { if (e.target && e.target.classList && e.target.classList.contains('vd-lang')) set(e.target.value); });
  if (lang !== 'en') document.documentElement.lang = lang;
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);

  // ---- Help (admin and waiter): email only, with the reply time and the free setup visit ----
  const MAIL = 'marketing@veyracreatives.com';
  function help(kind) {
    const o = document.createElement('div'); o.className = 'overlay center vd-help-ov';
    const ic = p => `<span class="vh-i"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg></span>`;
    const row = (i, t, d, href, cta) => `<div class="vh-row">${ic(i)}<div><b>${t}</b><p>${d}</p>${href ? `<a class="btn btn-ghost btn-sm" href="${href}" target="_blank" rel="noopener">${cta}</a>` : ''}</div></div>`;
    o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" style="max-width:520px"><div class="sheet-head"><h3>Help and support</h3><button type="button" class="icon-btn" data-x aria-label="Close">${window.icon ? icon('x', 20) : '×'}</button></div>
      <div class="sheet-body vd-help">
        <div class="vh-lang"><span>Language</span>${picker()}</div>
        ${kind === 'waiter' ? row('<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M12 16v-4M12 8h.01"/>', 'Waiter app help', 'Tap a table to see its orders and calls. Tap Take order to add dishes. Accept sends guest QR orders to the kitchen. Tap Served when food reaches the table.') : ''}
        ${row('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', 'Email us', kind === 'waiter' ? 'Problem with the app? Ask the owner, or email us.' : 'We reply within 2 hours, 10 AM to 7 PM, Monday to Saturday.', `mailto:${MAIL}?subject=${encodeURIComponent('Help with Veyra Dine In')}`, MAIL)}
        ${kind === 'waiter' ? '' : row('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>', 'Free setup visit', 'Restaurants in Navi Mumbai and Thane get a free visit: we add your menu, set up the printer and train your staff.', `mailto:${MAIL}?subject=${encodeURIComponent('Free setup visit for my restaurant')}&body=${encodeURIComponent('Restaurant name:\nArea:\nBest day and time:')}`, 'Ask for a visit')}
        ${kind === 'waiter' ? '' : row('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>', 'How-to guides', 'Step-by-step guides for every main feature.', 'https://dinein.veyracreatives.com/features#guides', 'Open guides')}
      </div></div>`;
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-x]')) o.remove(); });
    document.body.appendChild(o);
  }
  window.VDI18n = { set, tx, picker, get lang() { return lang; }, langs: LANGS };
  window.VDHelp = { open: help };
})();
