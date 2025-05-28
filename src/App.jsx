import React, { useEffect, useRef, useState } from "react";

export default function InterviewAssistant() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  const ASSEMBLYAI_TOKEN = import.meta.env.VITE_ASSEMBLYAI_TOKEN;
  const startListening = async () => {
    setListening(true);
    console.log("Assembly token:", import.meta.env.VITE_ASSEMBLYAI_TOKEN);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const ws = new WebSocket(
  `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${ASSEMBLYAI_TOKEN}`
);

    wsRef.current = ws;

    ws.onopen = () => {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0 && ws.readyState === 1) {
          ws.send(event.data);
        }
      });

      mediaRecorder.start(250);
    };

    ws.onmessage = async (message) => {
      const msg = JSON.parse(message.data);
      if (msg.text && msg.message_type === "FinalTranscript") {
        setTranscript(msg.text);
        setQuestion(msg.text);
        getAnswer(msg.text);
      }
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("WebSocket connection closed");
  };

  const stopListening = () => {
    setListening(false);
    mediaRecorderRef.current?.stop();
    wsRef.current?.close();
  };

  const getAnswer = async (text) => {
    const prompt = `You're helping a user respond in a job interview. Based on the following question, generate a brief, tailored, professional answer: "${text}"`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    setAnswer(data.choices[0].message.content);
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "24px", marginBottom: "1rem" }}>🎤 Live Interview Assistant</h1>

      <button
        onClick={listening ? stopListening : startListening}
        style={{
          padding: "10px 20px",
          backgroundColor: listening ? "#dc2626" : "#22c55e",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        {listening ? "Stop Listening" : "Start Listening"}
      </button>

      <div style={{ marginTop: "2rem" }}>
        <h4 style={{ marginBottom: "0.5rem" }}>🗣️ Detected Question:</h4>
        <div style={{ background: "#f0f0f0", padding: "1rem", borderRadius: "5px" }}>
          {question || "Waiting for audio..."}
        </div>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h4 style={{ marginBottom: "0.5rem" }}>💡 Suggested Answer:</h4>
        <div style={{ background: "#e0ffe0", padding: "1rem", borderRadius: "5px" }}>
          {answer || "Waiting for question..."}
        </div>
      </div>
    </div>
  );
}
