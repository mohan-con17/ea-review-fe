import { useState, useEffect, useMemo } from "react";
import { FileSearch, Upload } from "lucide-react";
import ChatInputWithUploads from "./ChatInputWithUploads";
import { getSession, streamReview } from "@/services/AgenticService";
import {
  Snackbar,
  Alert,
  Container,
  Paper,
  Typography,
  Box,
  Stack,
  LinearProgress,
} from "@mui/material";

// ------------------ Helpers -----------------------
function camelToNormal(str) {
  if (!str) return "";
  return str
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusColor(status) {
  if (!status) return "text.primary";
  const lower = status.toLowerCase();
  if (lower.includes("started")) return "blue";
  if (lower.includes("completed")) return "green";
  if (lower.includes("success")) return "green";
  return "red";
}

// ------------------ Markdown Renderer -----------------------
function renderMarkdown(text) {
  if (!text) return null;

  const parts = [];
  let remaining = text;
  let key = 0;
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/;

  while (remaining.length) {
    const match = remaining.match(regex);
    if (!match) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const idx = match.index;
    if (idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    }

    const token = match[0];
    const content = token.replace(/\*/g, "");

    if (token.startsWith("***")) {
      parts.push(
        <strong key={key++}>
          <em>{content}</em>
        </strong>
      );
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{content}</strong>);
    } else {
      parts.push(<em key={key++}>{content}</em>);
    }

    remaining = remaining.slice(idx + token.length);
  }

  return parts;
}

function cleanBullet(text) {
  return text.replace(/^[-•]\s*/, "").trim();
}

// ------------------ STAGE-AWARE PARSER -----------------------
function parseSuccessReview(summaryText) {
  if (!summaryText) {
    return {
      executive: [],
      bestPractice: [],
      strengths: [],
      recommendations: [],
    };
  }

  const lines = summaryText.split("\n").map((l) => l.trim());

  const result = {
    executive: [],
    bestPractice: [],
    strengths: [],
    recommendations: [],
  };

  let current = "executive";

  for (const line of lines) {
    if (!line || line.startsWith("---")) continue;

    const lower = line.toLowerCase();

    if (lower.startsWith("# stage 1")) current = "executive";
    else if (lower.startsWith("# stage 2")) current = "strengths";
    else if (lower.startsWith("# stage 3")) current = "bestPractice";
    else if (lower.startsWith("# stage 4")) current = "recommendations";
    else if (!line.startsWith("#")) result[current].push(line);
  }

  return result;
}

// ------------------ Similarity Score -----------------------
function extractSimilarityScore(summary) {
  if (!summary) return null;

  const text =
    typeof summary === "string"
      ? summary
      : typeof summary?.summary === "string"
      ? summary.summary
      : null;

  if (!text) return null;

  const match = text.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}

function getSimilarityColor(score) {
  if (score < 20) return "error";
  if (score < 60) return "warning";
  return "success";
}

// ------------------ Main Component -----------------------
const MainContentArea = ({ sessionId, onSessionCreated }) => {
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    severity: "info",
    message: "",
  });

  const [streaming, setStreaming] = useState(false);
  const [dots, setDots] = useState(".");
  const [stageEvents, setStageEvents] = useState([]);

  const [inputVisible, setInputVisible] = useState(true);
  const [backendReview, setBackendReview] = useState(null);

  const isViewOnly = Boolean(sessionId);

  useEffect(() => {
    const isStringId = typeof sessionId === "string" && sessionId.length > 0;
    const isObjId =
      sessionId && typeof sessionId === "object" && sessionId.session_id;

    if (!isStringId && !isObjId) {
      setSessionDetails(null);
      return;
    }

    const fetchSession = async () => {
      setLoadingSession(true);
      setBackendReview(null);
      try {
        const data = isStringId
          ? await getSession(sessionId)
          : await getSession(
              sessionId.session_id,
              sessionId.month,
              sessionId.year,
              sessionId.date
            );

        setSessionDetails(data?.details || data || null);
      } catch {
        setToast({
          open: true,
          severity: "error",
          message: "Failed to load session details.",
        });
      } finally {
        setLoadingSession(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const activeEvent = useMemo(
    () => (stageEvents.length ? stageEvents[stageEvents.length - 1] : null),
    [stageEvents]
  );

  useEffect(() => {
    if (!activeEvent || !streaming) return;
    const id = setInterval(
      () => setDots((d) => (d.length < 5 ? d + "." : ".")),
      400
    );
    return () => clearInterval(id);
  }, [activeEvent, streaming]);

  // ------------------ Handle Send -----------------------
  const handleSend = async (message, attachments) => {
    try {
      setInputVisible(false);

      const single = attachments?.[0] ?? null;
      let metadataPayload;

      if (single?.type?.includes("json")) {
        metadataPayload = single.content;
      } else if (
        single &&
        (single.type?.startsWith("image/") || single.type === "application/pdf")
      ) {
        metadataPayload = { arch_img_url: single.content };
      } else if (single) {
        metadataPayload = { text_content: single.content };
      } else if (message?.trim()) {
        metadataPayload = { text_content: message.trim() };
      }

      setStreaming(true);
      setStageEvents([]);
      setBackendReview(null);
      setSessionDetails(null);

      await streamReview(
        { metadata: metadataPayload },
        {
          onStage: (evt) => {
            if (evt && evt.stage !== "agents_stage") {
              setStageEvents((p) => [...p, evt]);
            }
          },
          onFinal: async (result) => {
            setBackendReview(result);

            const id = result?.review_id;
            if (id) onSessionCreated?.(id);

            if (id) {
              setLoadingSession(true);
              try {
                const data = await getSession(id);
                setSessionDetails(data?.details || data);
              } finally {
                setLoadingSession(false);
              }
            }

            setToast({
              open: true,
              severity: "success",
              message: "Review completed.",
            });

            setStreaming(false);
          },
          onError: () => setStreaming(false),
        }
      );
    } catch {
      setStreaming(false);
    }
  };

  // ------------------ Review Selection -----------------------
  const review =
    backendReview || sessionDetails?.details || sessionDetails || null;

  const finalSummary = review?.summary || review?.formatting_summary || null;

  const finalSummaryText =
    typeof finalSummary === "string"
      ? finalSummary
      : typeof finalSummary?.summary === "string"
      ? finalSummary.summary
      : null;

  const similarityScore = extractSimilarityScore(finalSummary);
  const reviewLoaded = Boolean(finalSummaryText || review?.review_id);

  const parsed =
    reviewLoaded && finalSummaryText
      ? parseSuccessReview(finalSummaryText)
      : null;

  // ------------------ UI -----------------------
  return (
    <Container
      sx={{ display: "flex", flexDirection: "column", height: "100%", py: 2 }}
    >
      <Box sx={{ width: "100%", mx: "auto", flex: 1, overflowY: "auto" }}>
        {/* Header + Executive Summary */}
        <Stack spacing={2} alignItems="center" sx={{ mb: 3 }}>
          {!reviewLoaded && (
            <>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  bgcolor: "#eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileSearch size={32} />
              </Box>

              <Typography variant="h4">
                Enterprise Architecture Review
              </Typography>

              {!isViewOnly && (
                <Stack direction="row" spacing={1}>
                  <Upload size={20} />
                  <Typography color="text.secondary">
                    Upload your architecture files for review
                  </Typography>
                </Stack>
              )}
            </>
          )}

          {parsed && (
            <Paper variant="outlined" sx={{ p: 1, width: "100%" }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography fontWeight={600}>
                  Review ID: {review?.review_id}
                </Typography>

                {similarityScore != null && (
                  <Box sx={{ width: 200 }}>
                    <Typography variant="caption">
                      Similarity with Standard Architecture
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={similarityScore}
                      color={getSimilarityColor(similarityScore)}
                    />
                    <Typography variant="caption">
                      {similarityScore}%
                    </Typography>
                  </Box>
                )}
              </Stack>

              <Box sx={{ mt: 1 }}>
                <Typography fontWeight={600} variant="body2">
                  Executive Summary
                </Typography>
                <ul>
                  {parsed.executive.map((l, i) => (
                    <li key={i}>
                      <Typography variant="body2">
                        {renderMarkdown(cleanBullet(l))}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Box>
            </Paper>
          )}
        </Stack>

        {/* Streaming Progress */}
        {streaming && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Review Live Status
            </Typography>

            {activeEvent ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <Typography variant="subtitle2">
                  {camelToNormal(activeEvent.stage)} {dots}
                </Typography>
                <Typography
                  sx={{
                    color: getStatusColor(activeEvent.status),
                    fontWeight: 600,
                  }}
                >
                  {camelToNormal(activeEvent.status)}
                </Typography>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Waiting for updates…
              </Typography>
            )}
          </Paper>
        )}

        {/* Remaining Sections */}
        {parsed && (
          <>
            <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
              <Paper variant="outlined" sx={{ p: 1, width: "65%" }}>
                <Typography fontWeight={600} variant="body2">
                  Strengths in Current Architecture
                </Typography>
                <ul>
                  {parsed.strengths.map((l, i) => (
                    <li key={i}>
                      <Typography variant="body2">
                        {renderMarkdown(cleanBullet(l))}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1, width: "35%" }}>
                <Typography fontWeight={600} variant="body2">
                  Best Practices
                </Typography>
                <ul>
                  {parsed.bestPractice.map((l, i) => (
                    <li key={i}>
                      <Typography variant="body2">
                        {renderMarkdown(cleanBullet(l))}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Paper>
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography fontWeight={600} variant="body2">
                Recommendations
              </Typography>
              <ul>
                {parsed.recommendations.map((l, i) => (
                  <li key={i}>
                    <Typography variant="body2">
                      {renderMarkdown(cleanBullet(l))}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Paper>
          </>
        )}
      </Box>

      {!isViewOnly && inputVisible && (
        <Box sx={{ width: "70%", mx: "auto" }}>
          <ChatInputWithUploads onSend={handleSend} disabled={streaming} />
        </Box>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
      >
        <Alert severity={toast.severity}>{toast.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default MainContentArea;
