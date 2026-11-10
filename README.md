# Paciente simulado XR: anafilaxia

Simulador clínico en 3D para entrenar el manejo inicial de una anafilaxia. Funciona en el navegador del ordenador, en visores de realidad virtual (Meta Quest) y en teléfonos Android con realidad aumentada.

![Paciente en la camilla con el monitor y el panel de acciones](docs/captura.png)

> Paciente y parámetros ficticios, solo para entrenamiento. No usar para decisiones clínicas reales.

## El caso

**Sr. Tapia, 46 años, 82 kg.** Sala de observación de urgencias. Está con una pielonefritis aguda y hace 8 minutos comenzó ceftriaxona 1 g EV. Sin alergias conocidas. El técnico te llama: el paciente dice que le pica todo el cuerpo y que le cuesta respirar.

- El paciente empeora en tiempo real: habones, edema de labios, sibilancias, hipotensión y, sin tratamiento, paro.
- Los signos se ven en su cuerpo y en el monitor (FC, SpO₂, PA y FR).
- Lo examinas tocando las etiquetas sobre el paciente: vía aérea, auscultación con sonido, pulso y piel.
- Eliges entre 10 acciones; algunas no corresponden o no son prioritarias.
- La adrenalina IM exige elegir el sitio de punción: muslo o deltoides.
- Al terminar, una pauta revisa 10 objetivos con tus tiempos.

El reloj del caso corre 3 veces más rápido que el real.

## Cómo usarlo

### En línea (recomendado)

Publica el repositorio en Vercel, GitHub Pages o Netlify y abre el enlace. Al ser HTTPS, el visor y el teléfono entran sin avisos de seguridad. En el ordenador, la portada muestra un código QR para abrir el caso en el visor o el teléfono.

**Vercel:** en vercel.com elige *Add New → Project*, importa este repositorio y pulsa *Deploy*. No hay que configurar nada.

**GitHub Pages:** en el repositorio ve a *Settings → Pages*, elige la rama `main` y la carpeta `/ (root)`, y guarda.

### Sin internet

Descarga el repositorio y abre `index.html` con doble clic. Funciona en pantalla; para VR o AR hace falta publicarlo en HTTPS.

## Compatibilidad

| Dispositivo | Modo |
|---|---|
| Ordenador (Chrome, Edge, Firefox, Safari) | Pantalla, con ratón |
| Meta Quest y otros visores con WebXR | Realidad virtual y passthrough |
| Android con Chrome y ARCore | Realidad aumentada: el paciente se coloca en el piso o sobre una mesa |
| iPhone y iPad | Solo pantalla, porque Safari no ofrece WebXR |

## Base clínica

- Resuscitation Council UK. *Emergency treatment of anaphylaxis: guidelines for healthcare providers* (2021).
- World Allergy Organization. Guías de anafilaxia.

La evolución del paciente es un modelo didáctico, no un modelo farmacológico validado. Revisa el caso contra tu protocolo local antes de usarlo con estudiantes.

## Modificar el caso

Todo el sitio es un solo archivo, `index.html`, que se genera desde la carpeta `fuente/`. Necesitas Node.js 18 o superior.

```bash
cd fuente
npm install
npm run build   # regenera ../index.html
npm test        # corre escenarios clínicos sobre el modelo
```

| Archivo | Contenido |
|---|---|
| `fuente/src/sim.js` | Caso, acciones, fisiología, hallazgos del examen y pauta final |
| `fuente/src/main.js` | Escena 3D, monitor, sonido, modos VR, AR y pantalla |
| `fuente/src/template.html` | Portada, panel de acciones y estilos |
| `fuente/gen-mesh.mjs` | Genera el cuerpo del paciente (`npm run malla`) |

Para cambiar la historia o el texto del caso, edita `CASE` y `ACTIONS` al inicio de `sim.js` y vuelve a ejecutar `npm run build`.
