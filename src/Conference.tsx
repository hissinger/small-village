import { useEffect } from "react";

interface ConferenceProps {
  userId: string;
}

export default function Conference(props: ConferenceProps) {
  const baseUrl = "https://rtc.live.cloudflare.com/v1/apps";
  const appId = process.env.REACT_APP_CLOUDFLARE_APP_ID;
  const appSecret = process.env.REACT_APP_CLOUDFLARE_APP_SECRET;

  const createSession = async () => {
    const url = `${baseUrl}/${appId}/sessions/new`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appSecret}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      return data.data.sessionId;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  useEffect(() => {
    const createPeerConnection = async () => {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
        bundlePolicy: "max-bundle",
      });

      peerConnection.ontrack = (event) => {
        console.log("ontrack", event);
      };

      peerConnection.onsignalingstatechange = (event) => {
        console.log("onsignalingstatechange", peerConnection.signalingState);
      };

      peerConnection.oniceconnectionstatechange = (event) => {
        console.log(
          "oniceconnectionstatechange",
          peerConnection.iceConnectionState
        );
      };

      peerConnection.onicecandidate = (event) => {
        console.log("onicecandidate", event);
      };

      return peerConnection;
    };

    const pushTracks = async (
      sessionId: string,
      offer: RTCSessionDescriptionInit,
      transievers: RTCRtpTransceiver[]
    ) => {
      const url = `${baseUrl}/${appId}/sessions/${sessionId}/tracks/new`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionDescription: {
            sdp: offer.sdp,
            type: offer.type,
          },
          tracks: transievers.map(({ mid, sender }) => {
            return {
              location: "local",
              mid,
              trackName: sender?.track?.id,
            };
          }),
        }),
      });

      const data = await response.json();
      console.log("Push Tracks Response:", data);
      return data;
    };

    const run = async () => {
      const sessionId = await createSession();
      const pc = await createPeerConnection();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const transievers = stream.getTracks().map((track) => {
        return pc.addTransceiver(track, {
          direction: "sendrecv",
        });
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await pushTracks(sessionId, offer, transievers);

      const answer = new RTCSessionDescription({
        sdp: res.sessionDescription.sdp,
        type: res.sessionDescription.type,
      });

      await pc.setRemoteDescription(answer);
    };

    run();

    return () => {
      console.log("Cleanup");
    };
  }, []);

  return (
    <div>
      <h1>Conference</h1>
    </div>
  );
}
