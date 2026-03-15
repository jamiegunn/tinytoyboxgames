uniform float uTime;

uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uSpecularColor;
uniform vec3 uSkyColor;
uniform vec3 uSubsurfaceColor;

uniform float uOpacity;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vElevation;
varying float vCenterDepth;

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
        (c - a) * u.y * (1.0 - u.x) +
        (d - b) * u.x * u.y;
}

float fbm(vec2 p)
{
    float value = 0.0;
    float amplitude = 0.5;
    mat2 basis = mat2(1.7, -1.25, 1.25, 1.7);

    for (int i = 0; i < 4; i++)
    {
        value += noise(p) * amplitude;
        p = basis * p * 1.12;
        amplitude *= 0.5;
    }

    return value;
}

void main()
{
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    float bank = abs(vUv.x - 0.5) * 2.0;
    float shallowEdge = smoothstep(0.58, 1.0, bank);
    float depthFactor = clamp(vCenterDepth, 0.0, 1.0);
    float endFade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);

    float tintNoise = fbm(vec2(vUv.y * 5.2 - uTime * 0.05, vUv.x * 3.4));
    vec3 waterBase = mix(uShallowColor, uDeepColor, depthFactor);
    waterBase += (tintNoise - 0.5) * 0.05;
    waterBase = mix(waterBase, waterBase + vec3(0.08, 0.05, 0.02), shallowEdge * 0.18);

    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0);
    vec3 reflection = mix(waterBase, uSkyColor, fresnel * 0.75);

    vec3 lightDir = normalize(vec3(-0.4, 1.0, 0.6));
    vec3 halfDir = normalize(lightDir + viewDir);
    float nDotH = max(dot(normal, halfDir), 0.0);

    float sparkleNoise = fbm(vec2(vUv.y * 24.0 - uTime * 1.4, vUv.x * 10.0 + normal.x * 3.0));
    float sparkleMask = smoothstep(0.62, 0.9, sparkleNoise + vElevation * 18.0);
    float specTight = pow(nDotH, 180.0) * sparkleMask;
    float specWide = pow(nDotH, 36.0) * 0.16;

    float foamNoise = fbm(vec2(vUv.y * 10.0 - uTime * 0.25, bank * 3.5 + vUv.x * 2.0));
    float bankFoam = shallowEdge * smoothstep(0.52, 0.82, foamNoise + max(vElevation, 0.0) * 12.0) * endFade;
    float crestLight = smoothstep(0.0015, 0.01, vElevation);

    float caustic = noise(vec2(vUv.y * 18.0 + uTime * 0.18, vUv.x * 8.0 - uTime * 0.22));
    vec3 shallowScatter = uSubsurfaceColor * (1.0 - depthFactor) * (0.22 + caustic * 0.18);

    vec3 color = reflection;
    color += uSpecularColor * (specTight * 0.9 + specWide);
    color += shallowScatter;
    color += vec3(0.08, 0.1, 0.06) * crestLight * depthFactor * 0.25;
    color = mix(color, uSpecularColor, bankFoam * 0.35);
    color += vec3(0.02, 0.03, 0.02) * fresnel * 0.15;
    color = mix(uShallowColor, color, endFade);
    color = max(color, vec3(0.0));

    float alpha = mix(uOpacity * 0.58, uOpacity, depthFactor) * endFade;
    alpha += bankFoam * 0.08;
    alpha = clamp(alpha, 0.0, 0.98);

    gl_FragColor = vec4(color, alpha);
}
