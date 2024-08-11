"use client";

import { MultiOnClient } from "multion";
import Image from "next/image";
import { useState } from "react";

const multiOn = new MultiOnClient({
  apiKey: process.env.NEXT_PUBLIC_MULTION_API_KEY || "",
});

export default function WorkspaceBuilder() {
  const [inputText, setInputText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tabGroupData, setTabGroupData] = useState<{
    title: string;
    urls: string[];
  } | null>(null);
  const [extractedLinks, setExtractedLinks] = useState<{ subtopic: string; url: string }[]>([]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
  };

  const handleSubmit = async () => {
    if (!inputText.trim()) return;
  
    setSubmittedText(inputText);
    setInputText("");
    setIsLoading(true);
  
    try {
      console.log("Creating session...");
      const createResponse = await multiOn.sessions.create({
        url: "https://www.google.com",
      });
      const sessionId = createResponse.sessionId;
      console.log("Session created with ID:", sessionId);
  
      const searchQuery = inputText;
      console.log("Performing initial search...");
      await multiOn.sessions.step(sessionId, {
        cmd: `Search for "${searchQuery}"`,
      });
  
      console.log("Extracting subtopics...");
      const subtopicsResponse = await multiOn.sessions.step(sessionId, {
        cmd: "List 5 key subtopics or aspects related to the search query.",
      });
      
      console.log("Full subtopics response:", JSON.stringify(subtopicsResponse, null, 2));
  
      const subtopics = subtopicsResponse.message
        .split("\n")
        .filter((line) => line.trim() !== "")
        .slice(0, 5);  // Ensure we only get 5 subtopics
  
      let extractedLinks: { subtopic: string; url: string }[] = [];
  
      for (const subtopic of subtopics) {
        console.log(`Searching for subtopic: ${subtopic}`);
        try {
          await multiOn.sessions.step(sessionId, {
            cmd: `Search for "${searchQuery} ${subtopic}"`,
          });
  
          const extractLinkResponse = await multiOn.sessions.step(sessionId, {
            cmd: `Return only the URL of the most relevant and authoritative website about "${searchQuery} ${subtopic}". The response should contain nothing but the URL.`,
          });
  
          console.log(`Full response for "${subtopic}":`, JSON.stringify(extractLinkResponse, null, 2));
  
          if (extractLinkResponse.message) {
            const url = extractLinkResponse.message.trim();
            if (url.startsWith('http') && !url.includes('google.com')) {
              extractedLinks.push({ subtopic, url });
              console.log(`Extracted link for "${subtopic}": ${url}`);
            }
          }
        } catch (error) {
          console.error(`Error processing subtopic "${subtopic}":`, error);
        }
      }
  
      console.log("Extracted links:", extractedLinks);
  
      // If we didn't get any links, let's try to extract them from the search results
      if (extractedLinks.length === 0) {
        console.log("No links extracted. Attempting to extract from search results...");
        const searchResultsResponse = await multiOn.sessions.step(sessionId, {
          cmd: `List the top 5 search result URLs for "${searchQuery}". Each URL should be on a new line.`,
        });
  
        console.log("Search results response:", JSON.stringify(searchResultsResponse, null, 2));
  
        const urls = searchResultsResponse.message
          .split('\n')
          .filter(url => url.trim().startsWith('http') && !url.includes('google.com'))
          .slice(0, 5);
  
        extractedLinks = urls.map((url, index) => ({
          subtopic: `Result ${index + 1}`,
          url: url.trim()
        }));
      }
  
      setExtractedLinks(extractedLinks);
  
      // Set tab group data
      setTabGroupData({
        title: `@Web ${searchQuery}`,
        urls: extractedLinks.map(item => item.url),
      });
  
      console.log("Closing session...");
      await multiOn.sessions.close(sessionId);
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">MultiOn Workspace Builder</h1>

      <Image
        src="/images/multion.jpg"
        alt="MultiOn logo"
        width={900}
        height={400}
        className="mt-4"
        priority
      />

      <p className="mt-4 text-xl">
        You want to build a workspace around what topic?
      </p>
      <div className="mt-8">
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder="Enter your text here"
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-black"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Submit"}
        </button>
        {submittedText && (
          <p className="mt-2">Submitted text: {submittedText}</p>
        )}
        {tabGroupData && (
          <div className="mt-4">
            <h2 className="text-2xl font-bold">Tab Group Data:</h2>
            <p>Title: {tabGroupData.title}</p>
            <p>Relevant Links:</p>
            <ul className="list-disc pl-5">
              {extractedLinks.map((item, index) => (
                <li key={index}>
                  <strong>{item.subtopic}:</strong>{' '}
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                    {item.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}