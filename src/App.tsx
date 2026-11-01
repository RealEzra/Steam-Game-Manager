import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { Button, Container, HStack, Heading, Input, Text, VStack } from "@chakra-ui/react";
import { ColorModeButton } from "@/components/ui/color-mode";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <Container maxW="md" py="10">
      <HStack justify="flex-end" mb="4">
        <ColorModeButton />
      </HStack>

      <VStack gap="6" textAlign="center">
        <Heading size="2xl">Welcome to Tauri + React</Heading>

        <HStack justify="center" gap="4">
          <a href="https://vite.dev" target="_blank">
            <img src="/vite.svg" className="logo vite" alt="Vite logo" />
          </a>
          <a href="https://tauri.app" target="_blank">
            <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
          </a>
          <a href="https://react.dev" target="_blank">
            <img src={reactLogo} className="logo react" alt="React logo" />
          </a>
        </HStack>
        <Text color="fg.muted">Click on the Tauri, Vite, and React logos to learn more.</Text>

        <form
          style={{ width: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}
        >
          <HStack gap="2">
            <Input
              id="greet-input"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Enter a name..."
            />
            <Button colorPalette="blue" type="submit">
              Greet
            </Button>
          </HStack>
        </form>
        {greetMsg && <Text fontWeight="medium">{greetMsg}</Text>}
      </VStack>
    </Container>
  );
}

export default App;
