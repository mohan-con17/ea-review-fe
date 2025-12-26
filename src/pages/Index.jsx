// import { useState } from "react";
// import Box from "@mui/material/Box";
// import Header from "@/components/Header";
// import Sidebar from "@/components/Sidebar";
// import MainContentArea from "@/components/MainContentArea";

// const Index = () => {
//   const [selectedSessionId, setSelectedSessionId] = useState(null);

//   const handleNewChat = () => setSelectedSessionId(null);
//   const handleSessionCreated = (id) => setSelectedSessionId(id);

//   return (
//     <Box
//       sx={{
//         height: "100vh",
//         display: "flex",
//         flexDirection: "column",
//         overflow: "hidden", // no page scroll
//       }}
//     >
//       {/* Header: now part of the flex layout */}
//       <Header />

//       {/* Row: sidebar + main content */}
//       <Box
//         sx={{
//           flex: 1,
//           display: "flex",
//           minHeight: 0, // IMPORTANT: allows children to shrink & scroll inside
//           overflow: "hidden",
//         }}
//       >
//         <Sidebar
//           selectedSessionId={selectedSessionId}
//           onSessionSelect={setSelectedSessionId}
//           onNewChat={handleNewChat}
//         />

//         {/* Wrap main so we can hide outer scroll and scroll inside only */}
//         <Box sx={{ flex: 1, overflow: "hidden" }}>
//           <MainContentArea
//             sessionId={selectedSessionId}
//             onSessionCreated={handleSessionCreated}
//           />
//         </Box>
//       </Box>
//     </Box>
//   );
// };

// export default Index;

import { useState } from "react";
import Box from "@mui/material/Box";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MainContentArea from "@/components/MainContentArea";

const Index = () => {
  // We track the full session object to ensure we have path metadata (month/year)
  // required by the Backend to fetch history logs.
  const [selectedSession, setSelectedSession] = useState(null);

  const handleNewChat = () => {
    setSelectedSession(null);
  };

  const handleSessionSelect = (session) => {
    // Session object from Sidebar includes session_id, month_year, and path
    setSelectedSession(session);
  };

  const handleSessionCreated = (id) => {
    // When a review finishes and a new ID is generated, update state
    setSelectedSession({ session_id: id });
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // Prevents double scrollbars on the page
      }}
    >
      <Header />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Sidebar
          selectedSession={selectedSession}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
        />

        <Box sx={{ flex: 1, overflow: "hidden" }}>
          {/* FIX: The 'key' prop is the solution.
            By binding the key to the session_id, React will UNMOUNT the old 
            MainContentArea and MOUNT a fresh one whenever the session changes.
            This automatically resets all internal 'useState' variables (progress, results, visibility).
          */}
          <MainContentArea
            key={selectedSession?.session_id || "new-chat-session"}
            sessionId={selectedSession?.session_id}
            sessionData={selectedSession}
            onSessionCreated={handleSessionCreated}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Index;
