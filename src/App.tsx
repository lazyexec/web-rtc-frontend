import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  Camera,
  CameraOff,
  Check,
  CheckCheck,
  FileText,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  Pencil,
  Phone,
  PhoneCall,
  PhoneOff,
  Reply,
  Search,
  Send,
  Settings2,
  ThumbsUp,
  Trash2,
  User,
  Users,
  Video,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import animeAvatar from "@/assets/anime-avatar.svg";
import animeRoom from "@/assets/anime-room.svg";

type CallMode = "idle" | "audio" | "video";
type Delivery = "sent" | "delivered" | "read";
type RoomMode = "direct" | "group";

type Attachment = {
  id: number;
  name: string;
  sizeLabel: string;
  kind: string;
};

type Message = {
  id: number;
  text: string;
  sender: "me" | "other";
  senderName: string;
  time: string;
  status?: Delivery;
  edited?: boolean;
  replyTo?: number;
  attachments?: Attachment[];
  liked?: boolean;
};

const CONTACT = {
  name: "Emily",
  subtitle: "Online",
  avatar: animeAvatar,
};

function formatNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function seedMessages(mode: RoomMode, myName: string): Message[] {
  if (mode === "group") {
    return [
      {
        id: 1,
        text: "Welcome everyone. This room is ready for testing.",
        sender: "other",
        senderName: "Noah",
        time: "12:25",
      },
      {
        id: 2,
        text: "Perfect, let's test attachments and calls.",
        sender: "other",
        senderName: "Emily",
        time: "12:26",
      },
      {
        id: 3,
        text: "I joined as host.",
        sender: "me",
        senderName: myName,
        time: "12:27",
        status: "read",
      },
    ];
  }

  return [
    {
      id: 1,
      text: "Hey, ready to test the new call flow?",
      sender: "other",
      senderName: CONTACT.name,
      time: "12:28",
    },
    {
      id: 2,
      text: "Yes, UI is ready. Start when you want.",
      sender: "me",
      senderName: myName,
      time: "12:29",
      status: "read",
    },
    {
      id: 3,
      text: "Sharing the latest product doc for review.",
      sender: "other",
      senderName: CONTACT.name,
      time: "12:30",
      attachments: [{ id: 1, name: "roadmap.pdf", sizeLabel: "2.1 MB", kind: "application/pdf" }],
    },
  ];
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => seedMessages("direct", "You"));
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const [displayName, setDisplayName] = useState("You");
  const [roomIdInput, setRoomIdInput] = useState("test-room-1");
  const [roomModeInput, setRoomModeInput] = useState<RoomMode>("direct");
  const [joinedRoomId, setJoinedRoomId] = useState("test-room-1");
  const [joinedName, setJoinedName] = useState("You");
  const [joinedMode, setJoinedMode] = useState<RoomMode>("direct");
  const [isJoined, setIsJoined] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState<"chat" | "call">("chat");

  const [callMode, setCallMode] = useState<CallMode>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [callError, setCallError] = useState("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(
    () => localStorage.getItem("test_api_base_url") ?? "http://localhost:3000"
  );
  const [savedMessage, setSavedMessage] = useState("");

  const callLabel = useMemo(() => {
    if (callMode === "audio") return "Audio Call";
    if (callMode === "video") return "Video Call";
    return "No Active Call";
  }, [callMode]);

  const replyingTo = useMemo(
    () => messages.find((message) => message.id === replyTargetId) ?? null,
    [messages, replyTargetId]
  );

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return messages;

    return messages.filter((message) => {
      const inText = message.text.toLowerCase().includes(term);
      const inSender = message.senderName.toLowerCase().includes(term);
      const inAttachment = (message.attachments ?? []).some((file) =>
        file.name.toLowerCase().includes(term)
      );
      return inText || inSender || inAttachment;
    });
  }, [messages, search]);

  const roomTitle = joinedMode === "group" ? `Group Room: ${joinedRoomId}` : `1:1 Room: ${joinedRoomId}`;
  const roomSubtitle = joinedMode === "group" ? "Members: You, Emily, Noah" : CONTACT.subtitle;

  const onFilesPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const next = files.map((file, index) => ({
      id: Date.now() + index,
      name: file.name,
      sizeLabel: formatBytes(file.size),
      kind: file.type || "application/octet-stream",
    }));

    setPendingAttachments((current) => [...current, ...next]);
    event.target.value = "";
  };

  const onSend = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();

    if (editingMessageId !== null) {
      if (!trimmed) return;

      setMessages((current) =>
        current.map((message) =>
          message.id === editingMessageId
            ? { ...message, text: trimmed, edited: true, time: formatNow() }
            : message
        )
      );

      setDraft("");
      setEditingMessageId(null);
      return;
    }

    if (!trimmed && !pendingAttachments.length) return;

    setMessages((current) => [
      ...current,
      {
        id: current.length + 1,
        text: trimmed,
        sender: "me",
        senderName: joinedName,
        time: formatNow(),
        status: "sent",
        replyTo: replyTargetId ?? undefined,
        attachments: pendingAttachments.length ? pendingAttachments : undefined,
      },
    ]);

    setDraft("");
    setReplyTargetId(null);
    setPendingAttachments([]);
    setIsOtherTyping(false);
  };

  const onStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setDraft(message.text);
    setReplyTargetId(null);
  };

  const onDeleteMessage = (id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
    if (editingMessageId === id) {
      setEditingMessageId(null);
      setDraft("");
    }
    if (replyTargetId === id) {
      setReplyTargetId(null);
    }
  };

  const onToggleLike = (id: number) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, liked: !message.liked } : message))
    );
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setHasLocalVideo(false);
  };

  const setLocalStream = (stream: MediaStream) => {
    stopLocalStream();
    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      void localVideoRef.current.play().catch(() => undefined);
    }

    setHasLocalVideo(stream.getVideoTracks().length > 0);
  };

  const getUserMediaErrorText = (error: unknown) => {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") return "Camera/mic permission denied.";
      if (error.name === "NotFoundError") return "No camera or microphone found.";
      if (error.name === "NotReadableError") return "Camera/mic is already in use by another app.";
      return error.message;
    }
    return "Could not access media devices.";
  };

  const startAudio = async () => {
    setCallError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError("Media devices are not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      setCallMode("audio");
      setIsMuted(false);
      setIsCameraOn(false);
    } catch (error) {
      setCallError(getUserMediaErrorText(error));
    }
  };

  const startVideo = async () => {
    setCallError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCallError("Media devices are not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
      setCallMode("video");
      setIsMuted(false);
      setIsCameraOn(true);
    } catch (error) {
      setCallError(getUserMediaErrorText(error));
    }
  };

  const endCall = () => {
    stopLocalStream();
    setCallMode("idle");
    setIsMuted(false);
    setIsCameraOn(true);
    setCallError("");
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  };

  const saveApiUrl = () => {
    const trimmed = apiBaseUrl.trim();
    localStorage.setItem("test_api_base_url", trimmed);
    setApiBaseUrl(trimmed);
    setSavedMessage(`Saved: ${trimmed}`);
  };

  const joinRoom = () => {
    const safeName = displayName.trim() || "You";
    const safeRoomId = roomIdInput.trim() || "test-room-1";

    setJoinedName(safeName);
    setJoinedRoomId(safeRoomId);
    setJoinedMode(roomModeInput);
    setMessages(seedMessages(roomModeInput, safeName));
    setDraft("");
    setReplyTargetId(null);
    setEditingMessageId(null);
    setPendingAttachments([]);
    setSearch("");
    endCall();
    setActiveMobilePanel("chat");
    setIsJoined(true);
  };

  useEffect(() => {
    return () => {
      stopLocalStream();
    };
  }, []);

  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;

    if (callMode !== "video" || !isCameraOn || !localStreamRef.current) {
      videoEl.srcObject = null;
      return;
    }

    videoEl.srcObject = localStreamRef.current;
    void videoEl.play().catch(() => undefined);
  }, [callMode, isCameraOn, hasLocalVideo, isJoined]);

  useEffect(() => {
    localStorage.setItem("test_api_base_url", apiBaseUrl.trim());
  }, [apiBaseUrl]);

  return (
    <main className="dark h-[100dvh] overflow-hidden bg-background p-3 text-foreground md:h-screen md:p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="max-w-[70%] truncate">
            API: {apiBaseUrl}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen((current) => !current)}>
            <Settings2 className="size-4" />
            Settings
          </Button>
        </div>

        {isSettingsOpen ? (
          <Card className="w-full shrink-0 gap-3 border-border/70 bg-card/95 py-4 shadow-xl backdrop-blur">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-base">Test Settings</CardTitle>
              <CardDescription>Set your API base URL for quick testing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              <Input
                value={apiBaseUrl}
                onChange={(event) => setApiBaseUrl(event.target.value)}
                placeholder="https://api.example.com"
              />
              {savedMessage ? <p className="text-xs text-muted-foreground">{savedMessage}</p> : null}
            </CardContent>
            <CardFooter className="justify-end gap-2 p-4 pt-0">
              <Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>
                Close
              </Button>
              <Button onClick={saveApiUrl}>Save</Button>
            </CardFooter>
          </Card>
        ) : null}

        {!isJoined ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Card className="w-full max-w-4xl gap-3 border-border/70 bg-card/90 py-4">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-base">Join Chat Room</CardTitle>
                <CardDescription>Use name + roomId to test 1:1 or group chat flows.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 p-4 pt-0 md:grid-cols-[1fr_1fr_auto_auto]">
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                />
                <Input
                  value={roomIdInput}
                  onChange={(event) => setRoomIdInput(event.target.value)}
                  placeholder="Room ID"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={roomModeInput === "direct" ? "default" : "outline"}
                    onClick={() => setRoomModeInput("direct")}
                  >
                    <User className="size-4" />
                    1:1
                  </Button>
                  <Button
                    type="button"
                    variant={roomModeInput === "group" ? "default" : "outline"}
                    onClick={() => setRoomModeInput("group")}
                  >
                    <Users className="size-4" />
                    Group
                  </Button>
                </div>
                <Button type="button" onClick={joinRoom}>
                  Join
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                Joined as {joinedName} in {joinedRoomId} ({joinedMode === "group" ? "group" : "1:1"})
              </Badge>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  endCall();
                  setIsJoined(false);
                }}
              >
                Change Room
              </Button>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <Button
                type="button"
                variant={activeMobilePanel === "chat" ? "default" : "outline"}
                onClick={() => setActiveMobilePanel("chat")}
              >
                <MessageCircle className="size-4" />
                Chat
              </Button>
              <Button
                type="button"
                variant={activeMobilePanel === "call" ? "default" : "outline"}
                onClick={() => setActiveMobilePanel("call")}
              >
                <Phone className="size-4" />
                Call
              </Button>
            </div>

            <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[1.1fr_1fr]">
          <Card
            className={`${activeMobilePanel === "chat" ? "flex" : "hidden"} h-full min-h-0 gap-0 border-border/70 bg-card/80 py-0 backdrop-blur md:flex`}
          >
            <CardHeader className="shrink-0 border-b border-border/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={CONTACT.avatar} alt={CONTACT.name} />
                    <AvatarFallback>EM</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{roomTitle}</CardTitle>
                    <CardDescription>{roomSubtitle}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{joinedMode === "group" ? "Group" : "1:1"}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsOtherTyping((current) => !current)}
                  >
                    Typing
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search messages or file names"
                />
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-md border border-border/70 bg-background/80 p-3">
                {filteredMessages.map((message) => {
                  const isMine = message.sender === "me";
                  const replyTo = message.replyTo
                    ? messages.find((item) => item.id === message.replyTo)
                    : undefined;

                  return (
                    <div key={message.id} className={`group flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[85%] space-y-1">
                        {replyTo ? (
                          <div className="rounded-md border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                            Replying to: {replyTo.text || "Attachment"}
                          </div>
                        ) : null}

                        <div
                          className={`rounded-xl px-3 py-2 text-sm ${
                            isMine
                              ? "bg-primary text-primary-foreground"
                              : "border border-border/70 bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {joinedMode === "group" && !isMine ? (
                            <p className="mb-1 text-xs font-semibold text-primary">{message.senderName}</p>
                          ) : null}

                          {message.text ? <p>{message.text}</p> : null}

                          {message.attachments?.length ? (
                            <div className="mt-2 space-y-1">
                              {message.attachments.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between rounded-md bg-background/20 px-2 py-1 text-xs"
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <FileText className="size-3.5 shrink-0" />
                                    {file.name}
                                  </span>
                                  <span>{file.sizeLabel}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <p
                            className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
                              isMine ? "text-primary-foreground/80" : "text-muted-foreground"
                            }`}
                          >
                            {message.time}
                            {message.edited ? "(edited)" : ""}
                            {isMine && message.status === "sent" ? <Check className="size-3" /> : null}
                            {isMine && (message.status === "delivered" || message.status === "read") ? (
                              <CheckCheck className="size-3" />
                            ) : null}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => setReplyTargetId(message.id)}
                          >
                            <Reply className="size-3.5" />
                            Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => onToggleLike(message.id)}
                          >
                            <ThumbsUp className="size-3.5" />
                            {message.liked ? "Liked" : "Like"}
                          </Button>
                          {isMine ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => onStartEdit(message)}
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => onDeleteMessage(message.id)}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isOtherTyping ? (
                  <div className="text-xs text-muted-foreground">{joinedMode === "group" ? "Noah" : "Emily"} is typing...</div>
                ) : null}

                {!filteredMessages.length ? (
                  <div className="pt-6 text-center text-sm text-muted-foreground">No messages found.</div>
                ) : null}
              </div>

              <div className="shrink-0 space-y-3">
                {replyingTo ? (
                  <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/60 px-3 py-2 text-xs">
                    <span>Replying to: {replyingTo.text || "Attachment"}</span>
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => setReplyTargetId(null)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}

                {editingMessageId !== null ? (
                  <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/60 px-3 py-2 text-xs">
                    <span>Editing message</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={() => {
                        setEditingMessageId(null);
                        setDraft("");
                      }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : null}

                {pendingAttachments.length ? (
                  <div className="rounded-md border border-border/70 bg-muted/50 p-2">
                    <p className="mb-2 text-xs text-muted-foreground">Attached files</p>
                    <div className="max-h-28 space-y-2 overflow-y-auto pr-1">
                      {pendingAttachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 rounded-md border border-border/70 bg-background/80 px-2 py-1.5 text-xs"
                        >
                          <FileText className="size-3.5 shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="ml-auto shrink-0 text-muted-foreground">{file.sizeLabel}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setPendingAttachments((current) =>
                                current.filter((attachment) => attachment.id !== file.id)
                              )
                            }
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <form className="flex gap-2" onSubmit={onSend}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onFilesPicked}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Attach files"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip />
                  </Button>

                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={editingMessageId !== null ? "Edit your message..." : "Type a message..."}
                  />

                  <Button type="submit" size="icon" aria-label="Send message">
                    <Send />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`${activeMobilePanel === "call" ? "flex" : "hidden"} h-full min-h-0 gap-0 border-border/70 bg-card/80 py-0 backdrop-blur md:flex`}
          >
            <CardHeader className="shrink-0 border-b border-border/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{callLabel}</CardTitle>
                  <CardDescription>
                    Room: {joinedRoomId} ({joinedMode === "group" ? "group" : "1:1"})
                  </CardDescription>
                  {callError ? <p className="mt-1 text-xs text-destructive">{callError}</p> : null}
                </div>
                <Badge variant={callMode === "idle" ? "outline" : "default"}>
                  {callMode === "idle" ? "Idle" : "Live"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 p-4">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background">
                <img
                  className="h-full w-full object-cover"
                  src={animeRoom}
                  alt="Remote stream placeholder"
                />
                <div className="absolute left-3 top-3">
                  <Badge>{callMode === "idle" ? "Waiting" : "Remote stream"}</Badge>
                </div>

                <div className="absolute bottom-3 right-3 h-24 w-20 overflow-hidden rounded-lg border border-border/70 bg-muted">
                  {callMode === "video" && isCameraOn && hasLocalVideo ? (
                    <video ref={localVideoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      {callMode === "audio" ? <Mic className="size-4" /> : <CameraOff className="size-4" />}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="shrink-0 justify-center gap-2 border-t border-border/70 p-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                disabled={callMode === "idle"}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleCamera}
                disabled={callMode === "idle" || callMode === "audio"}
                aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
              >
                {isCameraOn ? <Camera /> : <CameraOff />}
              </Button>

              {callMode === "idle" ? (
                <>
                  <Button variant="secondary" onClick={startAudio}>
                    <PhoneCall />
                    Audio
                  </Button>
                  <Button onClick={startVideo}>
                    <Video />
                    Video
                  </Button>
                </>
              ) : (
                <Button variant="destructive" onClick={endCall}>
                  <PhoneOff />
                  End Call
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setMessages((current) => [
                    ...current,
                    {
                      id: current.length + 1,
                      text: `Quick event: ${callMode === "idle" ? "Ping" : `${callMode} call active`}`,
                      sender: "other",
                      senderName: joinedMode === "group" ? "Noah" : CONTACT.name,
                      time: formatNow(),
                    },
                  ])
                }
                aria-label="Generate test event"
              >
                <Phone className="size-4" />
              </Button>
            </CardFooter>
          </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default App;
