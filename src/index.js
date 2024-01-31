import { Ai } from "@cloudflare/ai";
import { Hono } from "hono";


import atupa from "./template.html";
import translate from "./translator.html";

const app = new Hono();

app.get("/", (c) => c.html(atupa));
app.get("/b", (c) => c.html(translate));


// Function to convert audio to text using Cloudflare AI
async function convertAudioToText(audioBuffer, ai) {
	const audioInputs = {
	  audio: [...new Uint8Array(audioBuffer)],
	};
  
	try {
	const audioResponse = await ai.run('@cf/openai/whisper', audioInputs);
	console.log("Model Response:", audioResponse);
	const textResult = JSON.stringify(audioResponse.text);
	 return textResult;
  } catch (error) {
	console.error('Error converting audio to text:', error);
	return { textResult: 'Error converting audio to text' }; // Return an error message
  }
  }

  // Common function for image generation
async function generateImage(ai, prompt) {
	const inputs = {
	  prompt,
	};
  
	try {
	  const response = await ai.run(
		'@cf/stabilityai/stable-diffusion-xl-base-1.0',
		inputs
	  );
  
	  return new Response(response, {
		headers: {
		  'content-type': 'image/png',
		},
	  });
	} catch (error) {
	  console.error('Error generating image:', error);
	  return new Response(JSON.stringify({ error: 'Error generating image' }), {
		status: 500,
		headers: {
		  'content-type': 'application/json',
		},
	  });
	}
  }

  
  app.post("/audio-to-text", async (c) => {
	const ai = new Ai(c.env.AI);
	
  
	try {
	  const formData = await c.req.formData();
	  const audioFile = formData.get("audio");
  
	  if (!audioFile) {
		return c.json({ error: "No audio file uploaded" });
	  }
  
	  const audioBuffer = await audioFile.arrayBuffer();

	  // Convert audio to text using Cloudflare AI
	  const prompt = await convertAudioToText(audioBuffer, ai);

	  return await generateImage(ai, prompt);
	} catch (error) {
	  console.error('Error processing audio file:', error);
	  return c.json({ error: 'Error processing audio file' });
	}
  });

  // Function to translate text using Cloudflare AI
async function translateText(ai, text, sourceLang, targetLang) {
	const translationInputs = {
	  text,
	  source_lang: sourceLang,
	  target_lang: targetLang,
	};

	try {
	  const translationResponse = await ai.run('@cf/meta/m2m100-1.2b', translationInputs);
	  return translationResponse.translated_text;
	} catch (error) {
	  console.error('Error translating text:', error);
	  return 'Error translating text';
	}
  }

  app.post("/translate", async (c) => {
	const ai = new Ai(c.env.AI);

	try {
	  const formData = await c.req.formData();
	  const textToTranslate = formData.get("text");

	  if (!textToTranslate) {
		return c.json({ error: "No text provided for translation" });
	  }

	  // Translate text using Cloudflare AI
	  const translatedText = await translateText(ai, textToTranslate, 'en', 'fr');

	  return new Response(JSON.stringify({ translatedText}));
	} catch (error) {
	  console.error('Error translating text:', error);
	  return c.json({ error: 'Error translating text' });
	}
  });


  app.onError((err, c) => {
	return c.text(err);
  });

  export default app;
