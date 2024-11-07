import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleFullscreen}
    >
      {isFullscreen ? (
        <Minimize2 className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Maximize2 className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle fullscreen</span>
    </Button>
  );
}