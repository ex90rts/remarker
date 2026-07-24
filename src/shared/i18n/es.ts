import type { Messages } from "./types";

export const es: Messages = {
  languageName: "Español",
  common: {
    appName: "ReMarker",
    refresh: "Actualizar",
    created: "Creado",
    copied: "Copiado",
    copy: "Copiar",
    cancel: "Cancelar",
    archive: "Archivar",
    delete: "Eliminar",
    empty: "Vacío",
    openSource: "Abrir fuente",
  },
  popup: {
    loading: "Cargando",
    failed: "Error",
    noSite: "Sin sitio",
    enableExtension: "Resaltado y búsqueda de palabras globales",
    enableCurrentSite: "Resaltado y búsqueda de palabras en este sitio",
    addFootprint: "Agregar a huellas",
    addedFootprint: "Ya está en huellas",
    managePage: "Consola de gestión",
  },
  content: {
    copy: "Copiar",
    speak: "Pronunciar",
    explain: "Explicar",
    saveWord: "Guardar palabra",
    translate: "Traducir",
    splitHighlight: "Dividir resaltado",
    highlight: "Resaltar",
    highlightColor: "Resaltar {{color}}",
    changeToColor: "Cambiar a {{color}}",
    delete: "Eliminar",
    explaining: "Explicando",
    explainingProgress: "Explicando...",
    explanation: "Explicación",
    translating: "Traduciendo",
    translatingProgress: "Traduciendo...",
    translation: "Traducción",
    regenerate: "Volver a generar",
    copyExplanation: "Copiar explicación",
    close: "Cerrar",
    copied: "Copiado",
    savedHighlights: "{{count}} resaltado{{plural}} guardado{{plural}}.",
  },
  options: {
    tabs: {
      footprints: "Huellas",
      highlights: "Resaltados",
      vocabulary: "Vocabulario",
      translations: "Traducciones",
      settings: "Ajustes",
      about: "Acerca de",
    },
    sidebar: {
      reportIssue: "Informar de un problema",
      collapse: "Contraer",
      expand: "Expandir",
    },
    columns: {
      pageTitle: "Título de la página",
      site: "Sitio",
      browsedAt: "Creado",
      highlightCount: "Resaltados",
      lookupCount: "Vocabulario",
      highlightedText: "Texto resaltado",
      source: "Fuente",
      status: "Estado",
      color: "Color",
      actions: "Acciones",
      word: "Palabra",
      original: "Original",
      context: "Contexto",
      audio: "Audio",
    },
    filters: {
      allColors: "Todos los colores",
      starredOnly: "Solo con estrella",
      reset: "Restablecer",
    },
    empty: {
      footprints: "No hay huellas para mostrar.",
      highlights: "No hay resaltados para mostrar.",
      vocabulary: "No hay elementos de vocabulario para mostrar.",
      translations: "No hay traducciones para mostrar.",
    },
    actions: {
      starFootprint: "Marcar huella",
      unstarFootprint: "Quitar estrella",
      archiveFootprint: "Archivar huella",
      copyHighlightedText: "Copiar texto resaltado",
      deleteHighlight: "Eliminar resaltado",
      expandTranslation: "Expandir explicación",
      collapseTranslation: "Contraer explicación",
      speakWord: "Pronunciar {{word}}",
      deleteVocabularyItem: "Eliminar elemento de vocabulario",
      deleteTranslation: "Eliminar traducción",
      copyExplanation: "Copiar explicación",
      export: "Exportar",
      exportJson: "Exportar JSON",
      exportMarkdown: "Exportar Markdown",
      importJson: "Importar JSON",
      saveSettings: "Guardar ajustes",
      restoreDefault: "Restaurar valor predeterminado",
    },
    confirmations: {
      archiveFootprint:
        "¿Archivar esta huella? Se ocultará de la lista actual.",
      deleteHighlight: "¿Eliminar este resaltado?",
      deleteVocabularyItem: "¿Eliminar este elemento de vocabulario?",
      deleteTranslation: "¿Eliminar esta traducción?",
    },
    settings: {
      llm: "LLM",
      llmCostNotice:
        "Nota: usar un LLM para traducir o consultar palabras puede generar costes, según el proveedor elegido. Configura y guarda tu clave con cuidado.",
      provider: "Proveedor",
      providerHelp:
        "La traducción consume poco coste; prioriza la velocidad de respuesta de la API.",
      customProvider: "Personalizado",
      providerDescriptions: {
        zhipu:
          "Hay modelos asequibles gratuitos, aunque pueden responder más lento.",
        gemini:
          "Incluye una cuota gratuita útil que Google restablece periódicamente.",
        openrouter:
          "Hay modelos gratuitos; usa openrouter/free o elige uno en el marketplace, pero no son estables suficientemente.",
        deepseek:
          "No tiene cuota gratuita oficial por ahora, pero v4 flash es muy barato: unos CNY 0,02 por 30 llamadas.",
        aliyun:
          "Los usuarios nuevos reciben cuota gratuita; después se empieza a facturar.",
        volcengine:
          "Los usuarios nuevos reciben cuota gratuita; después se empieza a facturar.",
        custom:
          "Usa cualquier recurso que se ajuste a tus necesidades, incluidos modelos locales, si cumple el formato de la API de OpenAI.",
      },
      baseUrl: "Base URL",
      apiKey: "API Key",
      apiKeyHelp: "Esta configuración solo se guarda en tu navegador local.",
      model: "Modelo",
      modelHelp:
        "Se recomiendan modelos Flash o similares para obtener respuestas más rápidas.",
      temperature: "Temperature",
      timeoutMs: "Tiempo de espera ms",
      promptTemplate: "Plantilla de prompt",
      promptTemplateHelp:
        "Variables disponibles: {{task}}, {{selection}}, {{context}}",
      behavior: "Comportamiento",
      autoCloseLookupPanelOnCopy:
        "Cerrar automáticamente el popup de búsqueda después de copiar",
      language: "Idioma",
      languageHelp:
        "El idioma seleccionado se usa para la interfaz y como idioma de destino de traducción del LLM. Se recomienda elegirlo al empezar a usar la extensión y no cambiarlo después.",
      pronunciation: "Pronunciación",
      merriamWebsterApiKey: "Merriam-Webster API Key",
      preferences: "Preferencias",
      enableExtensionGlobally: "Activar resaltado de páginas globalmente",
      recordsPageSize: "Tamaño de página de resaltados y vocabulario",
      defaultHighlightColor: "Color de resaltado predeterminado",
      disabledSites: "Sitios desactivados",
      disabledSitesHelp: "Un hostname por línea, por ejemplo: example.com",
      importExport: "Importar / Exportar",
      includeSensitiveConfig:
        "Incluir configuración sensible en la exportación JSON",
    },
    notices: {
      settingsSaved: "Ajustes guardados.",
      jsonImported: "JSON importado.",
      dataRefreshed: "Datos actualizados.",
      footprintStarred: "Huella marcada.",
      footprintUnstarred: "Se quitó la estrella.",
      footprintArchived: "Huella archivada.",
      highlightDeleted: "Resaltado eliminado.",
      vocabularyDeleted: "Elemento de vocabulario eliminado.",
      translationDeleted: "Traducción eliminada.",
      copied: "Copiado.",
      jsonExported: "JSON exportado.",
      markdownExported: "Markdown exportado.",
      promptRestored: "Prompt predeterminado restaurado.",
      pronunciationStarted: "Pronunciación iniciada.",
    },
    errors: {
      promptTemplateMissingVariables:
        "A la plantilla de prompt le faltan variables obligatorias: {{variables}}",
    },
    statusDescriptions: {
      active: "Este resaltado se restauró en la página fuente.",
      not_found:
        "No se encontró el ancla de texto guardada en la página fuente.",
      ambiguous:
        "El ancla de texto guardada coincidió con varios lugares en la página fuente.",
      pending: "Este resaltado aún no se ha confirmado en una página fuente.",
    },
    export: {
      exported: "Exportado",
      source: "Fuente",
      model: "Modelo",
      untitled: "Sin título",
    },
    about: {
      plan: {
        title: "Plan",
        body: "Las próximas funciones planificadas son un calendario de repaso de vocabulario basado en la curva del olvido, para convertir búsquedas rápidas en memoria a largo plazo, y sincronización de datos entre dispositivos.",
      },
      releases: {
        title: "Releases",
        v1_1: {
          version: "1.1.0",
          summary: "Mejora la interfaz y agrega huellas de las páginas visitadas.",
          feature1: "Mejora los estilos de la extensión y la consola de gestión.",
          feature2:
            "Agrega huellas para recopilar y gestionar las páginas visitadas durante la lectura.",
        },
        v1_0: {
          version: "1.0.0",
          summary:
            "La primera versión estable se centra en leer, anotar, consultar palabras con IA y conservar el contexto de aprendizaje entre visitas.",
          feature1:
            "Resalta pasajes memorables en páginas web y gestiona esos resaltados en un solo lugar.",
          feature2:
            "Usa un modelo de IA para explicar palabras seleccionadas en contexto y guardarlas automáticamente en el vocabulario.",
          feature3:
            "Al volver a una página, restaura resaltados y subrayados de vocabulario, con traducciones disponibles desde la página.",
          feature4:
            "Reproduce la pronunciación de palabras mediante audio de diccionario configurado o síntesis de voz del navegador como respaldo.",
          feature5:
            "Importa y exporta los datos clave de aprendizaje para copias de seguridad, repaso y migración.",
        },
      },
    },
  },
};
