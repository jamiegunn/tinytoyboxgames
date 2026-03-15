uniform float uTime;
uniform float uFlowSpeed;

attribute vec3 aAcrossSpan;
attribute vec3 aFlowSpan;

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
    mat2 basis = mat2(1.6, -1.2, 1.2, 1.6);

    for (int i = 0; i < 4; i++)
    {
        value += noise(p) * amplitude;
        p = basis * p * 1.15;
        amplitude *= 0.5;
    }

    return value;
}

float heightAt(vec2 uv, float flow)
{
    float bank = abs(uv.x - 0.5) * 2.0;
    float midChannel = 1.0 - smoothstep(0.18, 1.0, bank);

    vec2 flowUv = vec2((uv.x - 0.5) * 2.15, uv.y * 6.2 - flow * 0.38);
    float lateralWarp = (fbm(flowUv * vec2(1.4, 0.65) + vec2(0.0, flow * 0.12)) - 0.5) * 0.45;
    vec2 broadUv = vec2(flowUv.x + lateralWarp, flowUv.y * 0.62);
    float broad = (fbm(broadUv) - 0.5) * 0.032;

    vec2 streakUv = vec2(flowUv.x * 4.0 + broad * 14.0, flowUv.y * 2.6 - flow * 0.8);
    float streaks = (noise(streakUv) - 0.5) * 0.012;

    float ripples = sin(flowUv.y * 13.0 + lateralWarp * 7.0 + uv.x * 5.2 - flow * 2.4) * 0.0045;
    ripples += sin(flowUv.y * 22.0 - uv.x * 8.0 - flow * 3.4) * 0.0025;

    return (broad + streaks + ripples) * midChannel;
}

void main()
{
    vUv = uv;

    float flow = uTime * uFlowSpeed;
    vec3 pos = position;
    float h = heightAt(uv, flow);

    pos.y += h;

    vElevation = h;
    vCenterDepth = 1.0 - smoothstep(0.14, 1.0, abs(uv.x - 0.5) * 2.0);

    float eps = 0.01;
    float hAcross = heightAt(vec2(min(uv.x + eps, 1.0), uv.y), flow);
    float hFlow = heightAt(vec2(uv.x, min(uv.y + eps, 1.0)), flow);

    vec3 acrossTangent = aAcrossSpan * eps + vec3(0.0, hAcross - h, 0.0);
    vec3 flowTangent = aFlowSpan * eps + vec3(0.0, hFlow - h, 0.0);
    vec3 normal = normalize(cross(flowTangent, acrossTangent));

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);

    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
