# 📝 Las notas

jun 2, 2026

## Reunión del 2 jun 2026 a las 10:32 GMT-03:00

Registros de la reunión [Transcripción](https://docs.google.com/document/d/1hYztNmdUUMUSojxsfATHhj9S9bDmIGRTyMRsZSM8fRQ/edit?usp=drive_web&tab=t.jpgxezqhvivf) 

### Resumen

Revisión técnica de interfaz, segmentación de creadores y protocolos de evaluación para optimizar la gestión de campañas.

**Interfaz y segmentación estratégica**  
Validación positiva sobre la nueva paleta de colores y el filtrado de chats. Se aprobó segmentar a los creadores entre activos y prospección para optimizar su gestión.

**Gestión de campañas y datos**  
Se definió que la plataforma gestionará el contacto inicial y seguimiento, excluyendo procesos de pago. Las métricas de Kernel se actualizarán solo al iniciar campañas para ahorrar recursos.

**Evaluación e integración técnica**  
El sistema de evaluación combinará perfiles automáticos con carga manual de datos históricos. Se estableció la configuración técnica para integrar N8N, Evolution API y el despliegue en la nube.

*Califica este resumen:* [Útil](https://google.qualtrics.com/jfe/form/SV_4YkxrBAaiTVqYCi?isGoogler=false&isHelpful=true) o [Poco útil](https://google.qualtrics.com/jfe/form/SV_4YkxrBAaiTVqYCi?isGoogler=false&isHelpful=false)

### Próximos pasos

- [ ] Definir etiquetas: Establecer etiquetas y descripciones para centralizar la gestión en la vista de chats. Permitir modificaciones basadas en estas definiciones.

- [ ] Definir puntuación UGC: Determinar los criterios de evaluación para perfiles de creadores de contenido combinando datos de Kernel, métricas de contenido orgánico y rendimiento en pautas. (Esto por ahora no quiero que te centres)

- [ ] \[Iorfi\] Conectar API Evolution: Integrar las credenciales de Evolution API en la plataforma N8N para automatizar el flujo de mensajes. Utilizar el flujo de gastos de marketing como plantilla de referencia.

### Detalles

* **Actualizaciones en la interfaz de usuario**: Iorfi presenta una serie de cambios en la interfaz, incluyendo una nueva paleta de colores y una vista de chats centralizada. Esta actualización permite filtrar los mensajes por estado (leídos o no leídos) y añadir etiquetas a las conversaciones, funcionalidades que Santiago Giovannetti valida positivamente ([00:00:47](#00:00:47)).

* **Segmentación de creadores de contenido**: Iorfi propone organizar a los creadores de contenido generado por el usuario (UGC) en dos secciones distintas: activos (personas que ya están en el sistema) y prospección (una nueva funcionalidad para iniciar búsquedas desde cero). Santiago Giovannetti concuerda en que esta separación facilita la gestión y la identificación de posibles candidatos ([00:00:47](#00:00:47)).

* **Funcionalidad de campañas**: Santiago Giovannetti describe el flujo de trabajo para las campañas, donde los usuarios pueden definir fechas de inicio y fin, descripciones, y objetivos de alcance. El sistema permitirá enviar mensajes masivos a los creadores para consultar disponibilidad y gestionar las respuestas. Ambas partes coinciden en que la plataforma servirá para cerrar el contacto inicial y realizar el seguimiento, excluyendo explícitamente cualquier integración para procesar pagos ([00:03:12](#00:03:12)).

* **Rol de Kernel en la actualización de datos**: Se define que la plataforma Kernel se utilizará exclusivamente para la evaluación de perfiles, extrayendo datos como seguidores e interacciones. Para evitar un consumo excesivo de recursos, Iorfi y Santiago Giovannetti acuerdan que las métricas no se actualizarán diariamente; en su lugar, se ejecutarán consultas masivas únicamente al momento de iniciar una campaña ([00:05:41](#00:05:41)).

* **Criterios de evaluación y scoring**: Santiago Giovannetti explica que el sistema de puntuación para los creadores de contenido comprenderá tres etapas: evaluación del perfil (vía Kernel), evaluación de contenido orgánico y evaluación de KPI de pauta. Se establece que, si bien la evaluación del perfil es automática, las otras dos categorías requerirán la carga manual de datos históricos de los creadores por parte de los usuarios, ya que no se cuenta con acceso directo a las plataformas de origen ([00:06:51](#00:06:51)).

* **Gestión de datos históricos**: Santiago Giovannetti y Iorfi acuerdan que, para los creadores con experiencia previa, se deben registrar las métricas históricas de rendimiento (engagement rate, vistas, shares) en la base de datos. Se planea crear una vista específica en la interfaz que permita a los usuarios visualizar prospectos pendientes de puntuar y creadores ya calificados, facilitando así la toma de decisiones ([00:12:38](#00:12:38)).

* **Integración técnica con N8N y Evolution API**: Santiago Giovannetti guía a Iorfi en la configuración del flujo de trabajo en N8N para la integración con Evolution API. Se enfatiza la necesidad de implementar filtros para responder únicamente a números específicos y se explica el proceso técnico para gestionar los tokens de acceso mediante la API de Google. Iorfi confirma que se encargará de realizar el despliegue del proyecto utilizando Antigravity y Cloud Run ([00:13:24](#00:13:24)).

*Revisa las notas de Gemini para asegurarte de que sean precisas. [Obtén sugerencias y descubre cómo Gemini toma notas](https://support.google.com/meet/answer/14754931)*

*Cómo es la calidad de **estas notas específicas?** [Responde una breve encuesta](https://google.qualtrics.com/jfe/form/SV_9vK3UZEaIQKKE7A?confid=oBmjvcdzGOMH3WbkTnawDxISOAIIigIgABgFCA&detailid=standard&screenshot=false) para darnos tu opinión; por ejemplo, cuán útiles te resultaron las notas.*

# 📖 Transcripción

jun 2, 2026

## Reunión del 2 jun 2026 a las 10:32 GMT-03:00 \- Transcripción

### 00:00:47 {#00:00:47}

**Santiago Giovannetti:** Ah, no. Significa.

**Iorfi:** Buenas,

**Santiago Giovannetti:** ¿Qué

**Iorfi:** ¿qué onda? ¿Todo bien?

**Santiago Giovannetti:** hacenos?

**Iorfi:** Muy bien. Bueno, eh primero que nada te comparto un toque de pantalla y te muestro los cambios que estuve haciendo, ¿te parece?

**Santiago Giovannetti:** Dale. Ah.

**Iorfi:** Dale. Eh, bueno, mira, ahí estamos. ¿Qué estoy mostrando? Estoy mostrando el MID, ¿no?

**Santiago Giovannetti:** Sí, ok.

**Iorfi:** Ahí va. Okay. E bueno, le cambié lo de la paleta de colores, eh, después cambié la vista de chats es nueva. La idea es que está acá centralizado.

**Santiago Giovannetti:** No,

**Iorfi:** Lo que te Sí,

**Santiago Giovannetti:** lo había visto algo.

**Iorfi:** que esté tipo que te aclare con colores de dónde viene, que puedas filtrar por no leídos,

**Santiago Giovannetti:** Espectacular.

**Iorfi:** la ideas que puedas responder de acá y que acá mismo puedas empezar a ponerle etiquetas. Estaría bueno definir un par de etiquetas, una descripción y que también puedan empezar a nada modificar sobre eso. Después separé lo de UGCs en UGCS activos y prospección.

### 00:03:12 {#00:03:12}

**Santiago Giovannetti:** Está

**Iorfi:** Me parece que está bueno porque, o sea, ya los nombres lo dicen, o sea,

**Santiago Giovannetti:** bueno.

**Iorfi:** por un lado están los chavones que ya los contactaste, que ya están en metidos en en el sistema y por otro lado podés armar una nueva búsqueda desde cero con perfiles que vos quieras y la idea es que vos puedas iniciar la búsqueda y te pueda tirar posibles candidatos, piolas.

**Santiago Giovannetti:** Espectacular.

**Iorfi:** Y nada, esto con con las diferentes cosas, me parece que eso va bien. Esto no lo toqué, esto de campañas. Si quieres explicar un poco cómo es exactamente lo que te habías imaginado.

**Santiago Giovannetti:** Okay. Yo lo que me imagino es,

**Iorfi:** Oh.

**Santiago Giovannetti:** ellos tienen eh una campaña para, no sé, para sacar en ahora vacaciones de invierno, por ejemplo, tienen vacaciones de invierno eh y necesitan, no sé, eh, mandarle a tanto tantos creadores de contenido. Entonces ellos ahí dentro de la campaña, ellos ponen cuál es la fecha de la campaña, tipo cuándo arranque y cuándo termina. Eh, ponen una descripción, una breve descripción de la campaña, eh, y ponen a cuánto a cuántos quieren llegar. Ahí podemos pensarlo, podemos pensarlo de dos maneras. Podemos pensarlo tipo quieren apuntar a mandarle una lista de 100 de 100 UGCS y solo van a seleccionar 5 10 ponerle o ponerle que mandarle siempre a todas ahí después podemos hacer listas internas y tipo bueno como vos habías puesto ya con con los tags tipo seleccionar por

### 00:04:33

**Santiago Giovannetti:** tags y mandarles a esos ahí me dio que que está abierto. Entonces, una vez que está eso, armamos la campaña e ponemos mandar envío y se envía el mensaje con la la descripción de la campaña y a todos los los creadores de contenido para saber si tienen disponibilidad y ahí se hacen una la serie de preguntas. Eh, así me lo imaginaba yo. Y después una vez que está eso, como entrás a la campaña y ves eh cuándo te respondieron, tipo quiénes tienen disponibilidad y ahí tenés como el eh dentro de la campaña puedes ver un poco lo los no sé los primeros los primeros 10 rankeados y ahí le mandas a eso con y ahí ya como dentro de la misma campaña le mandas el mensaje como ya de de que lo cerrás y ya cerrás el contacto dentro de la misma campaña.

**Iorfi:** Perfecto.

**Santiago Giovannetti:** Así lo tenía yo en la cabeza.

**Iorfi:** La idea es que todo esto también, o sea, se gestione también el pago, se gestione todo desde acá.

**Santiago Giovannetti:** No, no, el pago no, no. Esto es eh únicamente para cerrar el contacto, es para ahorrar toda la el paso previo de al contactarlos manualmente y de la parte del scoring,

**Iorfi:** Okay,

**Santiago Giovannetti:** pero no, no, o sea, no vamos a meter ninguna plataforma de pago en el

### 00:05:41 {#00:05:41}

**Iorfi:** okay.

**Santiago Giovannetti:** medio.

**Iorfi:** Bien. E y bien,

**Santiago Giovannetti:** Esa es la idea de la parte de campañas.

**Iorfi:** bien, bien. Clarísimo. Y después la parte en en dónde entraría Kernel y en dónde entraría NHN para vos.

**Santiago Giovannetti:** Mira, yo creo que la parte de kernel entraría para los cuando se le va a mandar eso. Eso hay que mantenerlo actualizado igual, eh, para saber el scoring. Kernel únicamente para revisarle las redes a la a los a los creadores de contenido. Entonces, con Kernel entraríamos y sacaríamos la cantidad de seguidores, las interacciones y todo eso desde kernel para todos los creadores de contenido. Eso podemos ver de mantener la lista actualizada o cuando se va a correr la campaña hacer únicamente una eh una bajada previa a que se haga la campaña. Si no tenemos que estar corriendo todos los días para todos los

**Iorfi:** Claro,

**Santiago Giovannetti:** contactos.

**Iorfi:** yo te voy a decir eso porque si no muy me parece como que es mucho procesamiento. Si para todos todo el tiempo tenerlos actualizados porque

**Santiago Giovannetti:** 100%. 100%. Estoy de acuerdo.

**Iorfi:** sí.

**Santiago Giovannetti:** Estoy de acuerdo. Ahí ahí lo el carne sería entonces cuando se va a correr la campaña, cuando se envía, eh se envía todos y se hace el tracko de todos los que les vas a enviar.

### 00:06:51 {#00:06:51}

**Santiago Giovannetti:** Entonces, no sé, de repente pone que tarda, no sé, una hora. Entonces, a la hora vas a tener el poner el sporing de los eh de los UTCs. Ahí después hay que definir qué parte del scoring entra. Eh, o sea, si el scol lo vamos a definir puramente con kernel o si en base a las preguntas que se les hace, en base a lo que responden, va a influir en el puntaje. Ahí la verdad que no no revisé bien lo que mandaron ellos de cómo puntúan a los UGCs. Eh, tenemos que terminar de definir eso o si no igual yo pedí una reunión esta semana, todavía no me contestaron, eh, pero también lo podemos hablar con ellos ahí.

**Iorfi:** Bueno, bien. Entonces, en principio lo de Kernel no armamos nada. Esperamos a ver qué vales son esos criterios de score y lo vemos

**Santiago Giovannetti:** Eso, esos no mandaron nada,

**Iorfi:** directamente.

**Santiago Giovannetti:** no mandaron nada en los mail que te que te reenvié.

**Iorfi:** ¿Cómo

**Santiago Giovannetti:** No mandaron nada de cómo los puntúan.

**Iorfi:** sabes que no estoy seguro?

**Santiago Giovannetti:** O sea, es que no hay un no hay un no hay un puntaje definido, pero sé que hay un o sea, sé que algo algo habían mandado, no sé.

### 00:07:54

**Iorfi:** Yo creo que a

**Santiago Giovannetti:** Reviso. A ver, a ver. Acá, acá lo que puso esta raiza puso. Perfil acá mandó este Excel donde ponen el perfil y ponen tipo de perfil. Okay. Acá acá hay unas partes de de evaluación que esto no lo vamos a poner poner de pregunta views al 25%, ¿cuánto tiene? Shares al 25% tipo todo esto. Son datos que entiendo que les pasa los PCs porque son datos propios de sus plataformas. Entonces ahí creo que vamos a tener que hacer una eh una evaluación por preguntas, sí o sí.

**Iorfi:** Okay. Preguntas por el chat a las personas.

**Santiago Giovannetti:** Exactamente, exactamente. Entonces, fíjate, fíjate el mail que ella mandó,

**Iorfi:** Okay.

**Santiago Giovannetti:** tipo que dice que hace, o sea, son tres, tres etapas. una lo que es la evaluación del perfil que lo que ya vamos a hacer con kernel, otra evaluación de contenido orgánico,

**Iorfi:** Sí,

**Santiago Giovannetti:** que eso en verdad lo Claro, evación de contenido orgánico. Igual eso no porque depende de la plataforma,

**Iorfi:** también podría ser con carner o no.

**Santiago Giovannetti:** pero quizás acá esto lo que estoy pensando eh eh lo que está diciendo por verción de contenido orgánico es contenido que ya hicieron con UGC dentro de dentro de NGR.

### 00:10:10

**Santiago Giovannetti:** Entonces creo que creo que es eso y por eso ese dato sí lo tienes porque eso eso es como es eh lo subieron desde su propia plataforma, entonces ahí sí tenés cuánto cuántos views, cuántos llegar y demás engagement rate.

**Iorfi:** ¿Cómo es entonces el contenido orgánico?

**Santiago Giovannetti:** Lo que es contenido orgánico es la evaluación, ellos mismos van a usar ese contenido de de tal quec. Entonces esos eh se fijan qué tanto les rindió ese contenido y a partir de ahí lo tienen no sé cuántas views tuvo,

**Iorfi:** Mm.

**Santiago Giovannetti:** cuánto engagement rate, cuántos shares. Entonces, en base en base a experiencias pasadas con este UGC,

**Iorfi:** Okay.

**Santiago Giovannetti:** eh definen el

**Iorfi:** Okay.

**Santiago Giovannetti:** puntaje.

**Iorfi:** Todos esos datos los carga una persona.

**Santiago Giovannetti:** En principio, sí. En principio,

**Iorfi:** Okay.

**Santiago Giovannetti:** sí.

**Iorfi:** Se lo dejamos como para que lo puedan cargar.

**Santiago Giovannetti:** Sí, sí, sí, sí.

**Iorfi:** Sería como un botón en dentro del perfil o del detalle del perfil de alguien que sea evaluar contenido orgánico y que pueda reseleccionar un par de opciones.

**Santiago Giovannetti:** Sí, sí, sí,

**Iorfi:** Bien.

**Santiago Giovannetti:** sí.

**Iorfi:** Y después evaluación KPI pauta.

### 00:11:14

**Santiago Giovannetti:** Y eso, fíjate, mira, te comparto un toque. Bien. O sea, esto es lo que ha mandado ella puso, te compartamos para el perfil las métricas de este documento. Entonces este es el documento, este es el documento que nos había mandado, que tiene estas tres evaluación de perfil que acá tiene seguidores, engagement rate, promedio de vistas cinco videos, tatá, demás. Eh, después tiene esto de evaluación de contenido orgánico, que ahí entiendo que es lo que cargan a mano y evaluación de KP y pauta. Esto de pauta,

**Iorfi:** Sì.

**Santiago Giovannetti:** fíjate que ya dice, tipo, usamos estas estas tres etapas, evaluación del perfil, cuando un perfil es nuevo, entonces acá únicamente es lo que ves en el front. Después contenido orgánico, la calidad de contenido orgánico para la marca según el score si amerita poner el po digital o no. Y después si esto pasa en la siguiente fase le ponen pauta y acá ven la performance que tuvo en pauta y entonces puso la idea es tener score del perfil puntado hasta 13 trapas para poder saber cuáles son los potenciales para siga esto es un poco de de data histórica, o sea, a partir de los de los de las campañas previas ahí les vamos a pedir toda la data que tengan igual, entonces ahí como que vamos a poder cargar una una base de datos principales,

### 00:12:38 {#00:12:38}

**Iorfi:** Bien,

**Santiago Giovannetti:** pero sí entiendo que a lo que son prospectos no vamos a

**Iorfi:** pero para y lo de evaluación pizz pauta e no lo sacamos nosotros con ningún sistema,

**Santiago Giovannetti:** No, no, eso, eso, eso nos lo tiene,

**Iorfi:** entonces

**Santiago Giovannetti:** no lo tiene que pasar, o sea, a no ser que nos den sus credenciales y tengamos acceso a las plataformas de de ellos, pero en principio creo que lo más fácil va a ser que que lo carguen desde

**Iorfi:** Okay. O sea,

**Santiago Giovannetti:** ahí.

**Iorfi:** en principio cuando se hace la prospección o cuando nosotros le carguemos los primeros usuarios que ya están cargados, le ponemos nada más que la evaluación del perfil y le dejamos como para que ellos puedan hacer las otras dos cosas.

**Santiago Giovannetti:** Ahí está lo ideal,

**Iorfi:** Deberíamos

**Santiago Giovannetti:** yo creo que lo que ahora el histórico que ya tienen de ellos,

**Iorfi:** tener

**Santiago Giovannetti:** o sea, esta tabla la deberíamos tener para todos los para todos los influencers con las métricas que esos ya tienen. Entonces, si nosotros ya tenemos data histórica, ya lo podemos puntuar nosotros de cierta manera.

**Iorfi:** Sí,

**Santiago Giovannetti:** O sea,

**Iorfi:** sí,

**Santiago Giovannetti:** la

**Iorfi:** sí. recontra y estaría bueno que para poder puntuar a alguien terminen de completarlo,

### 00:13:24 {#00:13:24}

**Santiago Giovannetti:** idea

**Iorfi:** entonces aparezca como una vista que sea tipo prospectos a puntuar o Gesalificados, solo eso.

**Santiago Giovannetti:** totalmente. O sea, creo que lo ideal acá va a ser tener tipo estas tres etapas que ellos quieren y así como bueno, para los que son nuevos, para los que son prospectos, únicamente tenemos esto. Para los que ya alguna vez trabajaron, tenemos también esta data. Entonces entra en el para el puntaje esto y para los que ya sirió la parte orgánica y le metieron pauta también tenemos esto. Entonces podemos como dividirlos en esos en esos tres si quieres.

**Iorfi:** Excelente.

**Santiago Giovannetti:** Entonces eso sería la parte bueno, kernel sería únicamente para esto, entonces para la evaluación de perfil.

**Iorfi:** Sí,

**Santiago Giovannetti:** Eh, y después te quería mostrar lo de Evolution API, que es igual ya lo conocés, pero este número,

**Iorfi:** sí.

**Santiago Giovannetti:** este High 20 es uno que saqué yo, eh, y lo tenemos y funciona

**Iorfi:** A ver, para entro desde ¿qué cuenta? desde darts.

**Santiago Giovannetti:** de

**Iorfi:** A ver si ya puedo entrar todo

**Santiago Giovannetti:** artes.

**Iorfi:** bien. Okay, ahí estoy dentro. El que decí que hay que usar es

**Santiago Giovannetti:** Perfecto.

### 00:14:43

**Iorfi:** 20\.

**Santiago Giovannetti:** Tengo que cambiar la la copita te voy a poner

**Iorfi:** A ver.

**Santiago Giovannetti:** pero igual eso también sonor, así que no pasa

**Iorfi:** Okay. Le conecto las credenciales de esto al NHN.

**Santiago Giovannetti:** nada.

**Iorfi:** ¿Tenés alguno que algún A ver, igual en principio todavía no voy a avanzar con lo voy a hacer esto que acabamos de decir,

**Santiago Giovannetti:** Eso para

**Iorfi:** pero supongo que tendrás algún flujo ya medio armado de N8N que se pueda armar tipo template y empezar a

**Santiago Giovannetti:** lo Sí, hay hay varios. Si querés agárrate este, no,

**Iorfi:** modificarlo.

**Santiago Giovannetti:** este, eh, este gastos de marketing. Este flujo está bastante bien. Acá le puse dos triggers, uno de Slack y uno de WhatsApp. Vamos a ver el de WhatsApp. Eh, y acá lo importante igual es la parte de acá de la salida de WhatsApp, que es lo único un poco más complejo.

**Iorfi:** S

**Santiago Giovannetti:** Acá el flujo en sí no tiene demasiado complejo. Sí, el, o sea, tiene el trier acá con el eh con API de Evolution API. Esto lo esto siempre lo ponemos como para que solo responda a ciertos números, porque si no responde a cualquier número y ahí te volves loco porque tenemos varios bots conectados.

### 00:15:55

**Santiago Giovannetti:** Entonces, siempre le metemos un filtro para que responda únicamente a ciertos grupos. Eh, ¿ves? Acá acá le ponemos tipo solo a estos números, solo a estos grupos. Eh, entonces eso es lo primero. Después acá lo que hicimos es una capa primera conversacional por si preguntan algo que no tiene nada que ver con

**Iorfi:** Perfecto.

**Santiago Giovannetti:** la eh ves acá clasificar la intención. Acá si agarra alguna de las palabras clave es va para abajo, si no va directamente para conversacional como para que tenga un contexto y no responda cu cosa. Después justo este es el de el de gasto de marketing. Entonces esta parte es de la generación esto para que ha un SQL y se meta BQU.

**Iorfi:** Perfecto.

**Santiago Giovannetti:** Se meta BQU y después te estructura la respuesta. Pero este es particular para lo de gasto de marketing. No le des tanta bola a todo esto. Lo que vas a necesitar de acá importante es esto que está acá. ¿Cómo cómo responder? porque no es tan simple como meterle el token, porque eh todo lo que es el dominio de ABN, como esto está hosteado, esto está hosteado dentro de Hike, eh lo que es este Evolution API, todo bastante protegido y para eso obtener tenes que hacer,

### 00:16:58

**Iorfi:** Sí,

**Santiago Giovannetti:** tenés que conseguir un token. Entonces, eh primero haces un llamado acá a a Google API para conseguir este token

**Iorfi:** bien,

**Santiago Giovannetti:** y después mandas el mensaje. Pero bueno, tenés que copiar literalmente esto, así como está todo esto.

**Iorfi:** perfecto.

**Santiago Giovannetti:** Ya hay una clave puesta acá, entonces directamente es copiar este estos estos nos y ya te lo te lo pegas directo. Este, agárratelo después. Esto, esto después cuando te metas ya en el coso igual duda, odio, preguntame, pero acá en este flujo está bastante está bastante bien

**Iorfi:** Buenísimo.

**Santiago Giovannetti:** ya

**Iorfi:** Y lo de rerrun de project lo puedo hacer directamente desde Antigravity, ¿no?

**Santiago Giovannetti:** lo del

**Iorfi:** Configuro lo de, o sea,

**Santiago Giovannetti:** Sí,

**Iorfi:** tengo que hacerlo de poner el MCP de Cloud Run y cuando lo tenga ya después puedo correr el

**Santiago Giovannetti:** exactamente,

**Iorfi:** proyecto.

**Santiago Giovannetti:** exactamente, exactamente.

**Iorfi:** Buenísimo. Bueno, voy a estar viendo eso también, así ya todo lo que voy haciendo se va subiendo todo.

**Santiago Giovannetti:** Perfecto, perfecto, hermoso.

**Iorfi:** Bueno, excelente. Cualquier otra cosa te escribo. Gracias.

**Santiago Giovannetti:** Avísame. Gracias. Abrazo.

### La transcripción finalizó después de 00:18:14

*Esta transcripción editable se generó por computadora y puede contener errores. Los usuarios también pueden cambiar el texto después de que se cree.*