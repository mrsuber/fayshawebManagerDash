import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, FONTS } from '../constants/theme';
import { SERVER_URL } from '../config';

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * A 360° panorama (equirectangular image) in a WebView with pannellum. The page is served from the Faysha origin
 * (baseUrl) so the image is same-origin for WebGL; a load failure is reported back and shown in the app's own words.
 */
export default function Panorama360({ url, title, yaw = 0, style }) {
  const [failed, setFailed] = useState(false);
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
<style>html,body{margin:0;height:100%;background:#0D0D0D;overflow:hidden}#p{width:100vw;height:100vh}
.tag{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(13,13,13,.85);border:1px solid rgba(200,164,93,.5);
border-radius:12px;padding:9px 16px;color:#F2E9D8;font:13px -apple-system,Roboto,sans-serif;text-align:center}
.tag b{display:block;color:#C8A45D;font-size:15px;margin-bottom:2px}</style></head><body>
<div id="p"></div>${title ? `<div class="tag"><b>${esc(title)}</b>Drag to look around</div>` : ''}
<script>
var post=function(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)};
try{var v=pannellum.viewer('p',{type:'equirectangular',panorama:${JSON.stringify(url).replace(/</g, '\\u003c')},autoLoad:true,
yaw:${Number(yaw) || 0},showControls:false,compass:false,showFullscreenCtrl:false,autoRotate:-2});
v.on('error',function(){post('error')});}catch(e){post('error')}
</script></body></html>`;

  if (!url || failed) {
    return (
      <View style={[st.box, style]}>
        <Text style={st.msg}>The 360° view could not be loaded. Check your connection and try again.</Text>
      </View>
    );
  }
  return (
    <WebView
      source={{ html, baseUrl: `${SERVER_URL}/` }}
      originWhitelist={['*']}
      style={[{ backgroundColor: COLORS.background }, style]}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      renderLoading={() => (
        <View style={[StyleSheet.absoluteFill, st.box]}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      )}
      onMessage={(e) => e.nativeEvent.data === 'error' && setFailed(true)}
    />
  );
}

const st = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background, padding: 24 },
  msg: { color: COLORS.textSecondary, fontFamily: FONTS.body, textAlign: 'center', fontSize: 13, lineHeight: 20 },
});
