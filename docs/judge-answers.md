# Judge answers: AI accuracy and data privacy

Short answers M1 can give on stage, each with the proof to point at.

## AI accuracy

**"How do you know the assistant isn't making things up?"**
It can only answer from Bedaya's own data, which we built from official Jordanian sources: the Greater Amman Municipality home-business guide (prepared with the Ministry of Industry, Trade and Supply), the Amman Chamber of Commerce fee table, the JFDA's home-food licensing statement, and the e-Government portal. Every answer links to its source. With the AI model switched on, the model gets only this data and is told never to invent fees, offices or documents.

**"What happens when it doesn't know?"**
It says so and names the right office with its website. For example, it has no verified income-tax rates, so it sends you to the Income and Sales Tax Department instead of guessing. Off-topic questions (like the weather) are politely declined.

**"How accurate is it?"**
We test it against 20 real questions in Arabic and English, including three it must *not* answer. It passes 20/20 (target 18). The pass/fail list is in [assistant-test-results.md](assistant-test-results.md) and is re-run after every data change (`npm run test:assistant`).

**"Fees change. What if your data is out of date?"**
Every fee carries its source and whether it is confirmed. Unconfirmed fees and durations are labelled "please confirm with the office" or "estimate" in the answer and in the business plan timeline. The data lives in one spreadsheet that M1 can update without touching code (`npm run knowledge`).

**"Does the AI decide whether my document is expired?"**
No. Missing, expired and blurry checks are plain code with fixed rules (an expiry date before today; OCR confidence below 0.6 or image quality below 0.5). The AI only rewrites each warning in friendly Arabic and English, and it is told to keep every fact and date exactly.

**"What if the AI service is slow or down during the demo?"**
Every AI call has a timeout (8 seconds). If the model is slow, fails or refuses, Bedaya falls back to the answer built from its data, so the user always gets an answer. The exact demo questions are also pre-saved.

## Data privacy

**"What personal data do you send to the AI?"**
- **Assistant:** the question and the recent chat, plus (once the wizard is done) the user's name, business type, sector and city, so it can pick the relevant steps. No ID numbers, phone numbers or documents.
- **Document checker:** only the warning type, document type and expiry date. Never the image, the ID number or the name.
- **Incubator reasons and business plan:** business details (name, sector, city, funding need) and the founder's name. The national ID number and phone number are never sent.

**"Where do the documents go?"**
OCR and storage are handled by the documents module (our M5 partner). The AI features read only the OCR result's document type, expiry date and quality scores.

**"Is the user in control?"**
Every processing purpose (OCR, AI assistant, sharing with incubators, e-signature) is recorded in a `consent_log` table with the consent version and time. Multi-apply fills forms for review; nothing is sent to an incubator until the user submits.

**"Does the AI provider keep or train on the data?"**
Bedaya calls the model through the commercial API, which by default does not use API inputs and outputs for training. Before launch we would also sign a data processing agreement and keep national ID numbers out of every AI request, as the code does today.

**"Can it run without any AI provider?"**
Yes. In mock mode (the default) every feature works offline from Bedaya's data, with no data leaving the server.
