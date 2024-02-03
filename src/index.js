import { Ai } from "@cloudflare/ai";
import { Hono } from "hono";


import atupa from "./template.html";
import translate from "./translator.html";
import analyte from "./analysis.html";

const app = new Hono();

app.get("/", (c) => c.html(atupa));
app.get("/b", (c) => c.html(translate));
app.get("/c", (c) => c.html(analyte));

// Function to save AI results to the database
async function saveResultToDatabase(database, query, result) {
	// Execute SQL to insert the query and result into the database
	await database.prepare(`
	  INSERT INTO query_results (query, result) VALUES (?, ?);
	`).bind(query, result).run();
  }

function formatSentiment(sentimentResult) {
	if (!sentimentResult || !sentimentResult.label || !sentimentResult.score) {
	  return "Sentiment: N/A";
	}

	const sentimentText = `${sentimentResult.label}, Score: ${sentimentResult.score}`;
	return sentimentText;
  }

async function performSentimentAnalysis(text, ai) {
	const sentimentInputs = {
	  text,
	};
  
	try {
	  const sentimentResponse = await ai.run(
		'@cf/huggingface/distilbert-sst-2-int8',
		sentimentInputs
	  );
  
	  return sentimentResponse[1]; // Assuming the model returns a single sentiment result
	} catch (error) {
	  console.error('Error performing sentiment analysis:', error);
	  return { error: 'Error performing sentiment analysis' };
	}
  }

// Function to save AI results to the database
async function saveAnalysisResult(database, timestamp, text, sent, image) {
	// Execute SQL to insert the query and result into the database
	await database.prepare(`
	  INSERT INTO classification (timestamp, text, sent, image) VALUES (?, ?, ?, ?);
	`).bind(timestamp, text, sent, image).run();
  }


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

  async function processImage(ai, imageBuffer) {
	const inputs = {
	  image: [...new Uint8Array(imageBuffer)],
	};
  
	try {
	  const response = await ai.run('@cf/microsoft/resnet-50', inputs);
	  return response;
	} catch (error) {
	  console.error('Error processing image:', error);
	  return { error: 'Error processing image' };
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
	const database = c.env.DB;
	
  
	try {
	  const formData = await c.req.formData();
	  const audioFile = formData.get("audio");
  
	  if (!audioFile) {
		return c.json({ error: "No audio file uploaded" });
	  }
  
	  const audioBuffer = await audioFile.arrayBuffer();

	  // Convert audio to text using Cloudflare AI
	  const prompt = await convertAudioToText(audioBuffer, ai);

	  // Use the database to save the AI response
	  //await saveResultToDatabase(database, "Audio-to-Text Conversion", prompt);

	  //const text = JSON.stringify(prompt.text);

	  // Generate a unique identifier (timestamp in this example)
	  //const timestamp = Date.now();

	  // Perform sentiment analysis on the converted text
      //const sentimentResult = await performSentimentAnalysis(text);

	  // Format sentiment result as text
     // const sent = formatSentiment(sentimentResult);
	  //console.log(sent);

	  // generate image
	  const view = await generateImage(ai, prompt);

	  // Classify image after generating it
	  //const imageProcessingResult = await processImage(view);
	 // console.log(imageProcessingResult);

	 // const maxEntry = imageProcessingResult.reduce((max, current) => (current.score > max.score) ? current : max);

      // Extract the label and score from the max entry
      //const maxLabel = maxEntry.label;
	 // const maxScore = maxEntry.score;
      ///const image = JSON.stringify(maxLabel + ' ' + maxScore);
	  //const image = imageProcessingResult;

	  // Use the database to save the AI response
     // await saveAnalysisResult(database, timestamp, text, sent, image);

	  return view;
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


  app.post("/analysis", async (c) => {
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

	  // Perform sentiment analysis on the converted text
      const sentimentResult = await performSentimentAnalysis(prompt, ai);

	  // Format sentiment result as text
      const sent = formatSentiment(sentimentResult);

	  // generate image
	  const view = await generateImage(ai, prompt);

	  // Classify image after generating it
	  const imageBuffer = await view.arrayBuffer();
	  const imageProcessingResult = await processImage(ai, imageBuffer);

	  return c.json({prompt, sent, imageProcessingResult});
	} catch (error) {
	  console.error('Error processing audio file:', error);
	  return c.json({ error: 'Error processing audio file' });
	}
  });


  app.onError((err, c) => {
	return c.text(err);
  });

  export default app;
