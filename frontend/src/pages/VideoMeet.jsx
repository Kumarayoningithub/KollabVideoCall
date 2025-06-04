
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Badge, IconButton, TextField, Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import styles from '../styles/videoComponent.module.css';
import server from '../environment';

const server_url = server;
const peerConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoref = useRef();
  const connections = useRef({});
  const iceBuffer = useRef({});

  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [showModal, setModal] = useState(true);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    getPermissions();
  }, []);

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      window.localStream = stream;
      if (localVideoref.current) localVideoref.current.srcObject = stream;
      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
    } catch (err) {
      console.error('Permission error:', err);
    }
  };

  const getUserMedia = () => {
    navigator.mediaDevices.getUserMedia({ video, audio }).then(getUserMediaSuccess);
  };

  const getUserMediaSuccess = stream => {
    window.localStream?.getTracks().forEach(track => track.stop());
    window.localStream = stream;
    if (localVideoref.current) localVideoref.current.srcObject = stream;

    Object.keys(connections.current).forEach(id => {
      if (id === socketIdRef.current) return;
      const peer = connections.current[id];
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      peer.createOffer().then(desc => {
        peer.setLocalDescription(desc).then(() => {
          socketRef.current.emit('signal', id, JSON.stringify({ sdp: peer.localDescription }));
        });
      });
    });
  };

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url);
    socketRef.current.on('signal', gotMessageFromServer);
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-call', window.location.href);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on('chat-message', addMessage);
      socketRef.current.on('user-left', id => {
        setVideos(v => v.filter(video => video.socketId !== id));
      });

      socketRef.current.on('user-joined', (id, clients) => {
        clients.forEach(socketListId => {
          const peer = new RTCPeerConnection(peerConfig);

          peer.onicecandidate = event => {
            if (event.candidate) {
              socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
            }
          };

          peer.ontrack = event => {
            const stream = event.streams[0];
            const audio = new Audio();
            audio.srcObject = stream;
            audio.autoplay = true;

            setVideos(prev => {
              const existing = prev.find(v => v.socketId === socketListId);
              if (existing) {
                return prev.map(v => (v.socketId === socketListId ? { ...v, stream } : v));
              }
              return [...prev, { socketId: socketListId, stream }];
            });
          };

          if (window.localStream) {
            window.localStream.getTracks().forEach(track => peer.addTrack(track, window.localStream));
          }

          connections.current[socketListId] = peer;
        });

        if (id === socketIdRef.current) {
          Object.entries(connections.current).forEach(([id2, peer]) => {
            if (id2 === socketIdRef.current) return;
            peer.createOffer().then(desc => {
              peer.setLocalDescription(desc).then(() => {
                socketRef.current.emit('signal', id2, JSON.stringify({ sdp: peer.localDescription }));
              });
            });
          });
        }
      });
    });
  };

  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    const peer = connections.current[fromId];
    if (!peer) return;

    if (signal.sdp) {
      const desc = new RTCSessionDescription(signal.sdp);
      peer.setRemoteDescription(desc).then(() => {
        // Flush ICE candidates
        (iceBuffer.current[fromId] || []).forEach(c =>
          peer.addIceCandidate(new RTCIceCandidate(c)).catch(console.error)
        );
        iceBuffer.current[fromId] = [];

        if (desc.type === 'offer' && peer.signalingState !== 'stable') {
          peer.createAnswer().then(answer => {
            peer.setLocalDescription(answer).then(() => {
              socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: peer.localDescription }));
            }).catch(err => console.error('❌ setLocalDescription error:', err));
          }).catch(err => console.error('❌ createAnswer error:', err));
        }
      }).catch(err => {
        console.error('❌ setRemoteDescription error:', err);
      });
    }

    if (signal.ice) {
      if (peer.remoteDescription?.type) {
        peer.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(console.error);
      } else {
        if (!iceBuffer.current[fromId]) iceBuffer.current[fromId] = [];
        iceBuffer.current[fromId].push(signal.ice);
      }
    }
  };

  const handleVideo = () => {
    const track = window.localStream?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideo(track.enabled);
    }
  };

  const handleAudio = () => {
    const track = window.localStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudio(track.enabled);
    }
  };

  const handleScreen = () => setScreen(!screen);

  useEffect(() => {
    if (screen) {
      navigator.mediaDevices.getDisplayMedia({ video: true }).then(stream => {
        const audioTracks = window.localStream?.getAudioTracks() || [];
        audioTracks.forEach(track => stream.addTrack(track));
        getUserMediaSuccess(stream);
      });
    }
  }, [screen]);

  const handleEndCall = () => {
    const tracks = localVideoref.current?.srcObject?.getTracks();
    tracks?.forEach(track => track.stop());
    window.location.href = '/';
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages(prev => [...prev, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) setNewMessages(prev => prev + 1);
  };

  const sendMessage = () => {
    socketRef.current.emit('chat-message', message, username);
    setMessage('');
  };

  const connect = () => {
    setAskForUsername(false);
    getUserMedia();
    connectToSocketServer();
  };

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter into Lobby</h2>
          {/* <TextField
            id="outlined-basic"
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            variant="outlined"
          /> */
          <TextField
  id="outlined-basic"
  placeholder="Username"
  value={username}
  onChange={e => setUsername(e.target.value)}
  variant="outlined"
  sx={{
    input: { 
      backgroundColor: 'white', 
      color: 'black', 
      borderRadius: '10px',      
      padding: '10px',            
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',       
      '& fieldset': {
        borderColor: 'white',
        borderRadius: '10px',
      },
      '&:hover fieldset': {
        borderColor: 'white',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'white',
      },
    },
  }}
/>

          
          
          
          
          }
          <Button variant="contained" onClick={connect}>Connect</Button>
          <div><video ref={localVideoref} autoPlay muted /></div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal && (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>Chat</h1>
                <div className={styles.chattingDisplay}>
                  {messages.length ? messages.map((item, index) => (
                    <div key={index}>
                      <p><b>{item.sender}</b></p>
                      <p>{item.data}</p>
                    </div>
                  )) : <p>No Messages Yet</p>}
                </div>
                <div className={styles.chattingArea}>
                  <TextField value={message} onChange={e => setMessage(e.target.value)} label="Enter Your chat" variant="outlined" />
                  <Button variant="contained" onClick={sendMessage}>Send</Button>
                </div>
              </div>
            </div>
          )}

          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: 'white' }}>{video ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
            <IconButton onClick={handleEndCall} style={{ color: 'red' }}><CallEndIcon /></IconButton>
            <IconButton onClick={handleAudio} style={{ color: 'white' }}>{audio ? <MicIcon /> : <MicOffIcon />}</IconButton>
            {screenAvailable && <IconButton onClick={handleScreen} style={{ color: 'white' }}>{screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}</IconButton>}
            <Badge badgeContent={newMessages} max={999} color="orange">
              <IconButton onClick={() => setModal(!showModal)} style={{ color: 'white' }}><ChatIcon /></IconButton>
            </Badge>
          </div>

          <video className={styles.meetUserVideo} ref={localVideoref} autoPlay muted></video>
          <div className={styles.conferenceView}>
            {videos.map(video => (
              <div key={video.socketId}>
                <video
                  data-socket={video.socketId}
                  ref={ref => ref && video.stream && (ref.srcObject = video.stream)}
                  autoPlay
                  playsInline
                ></video>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
