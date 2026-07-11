import type { Messages } from "./types";

export const es: Messages = {
  languageName: "Español",
  common: {
    appName: "Remarker",
    refresh: "Actualizar",
    created: "Creado",
    copied: "Copiado",
    copy: "Copiar",
    cancel: "Cancelar",
    delete: "Eliminar",
    empty: "Vacío",
    openSource: "Abrir fuente"
  },
  popup: {
    loading: "Cargando",
    failed: "Error",
    noSite: "Sin sitio",
    enableExtension: "Activar extensión",
    enableCurrentSite: "Activar sitio actual",
    openManagementPage: "Abrir página de gestión"
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
    savedHighlights: "{{count}} resaltado{{plural}} guardado{{plural}}."
  },
  options: {
    tabs: {
      highlights: "Resaltados",
      vocabulary: "Vocabulario",
      explanations: "Registros de búsqueda",
      settings: "Ajustes"
    },
    columns: {
      highlightedText: "Texto resaltado",
      source: "Fuente",
      status: "Estado",
      color: "Color",
      actions: "Acciones",
      word: "Palabra",
      context: "Contexto",
      audio: "Audio"
    },
    filters: {
      allColors: "Todos los colores",
      reset: "Restablecer"
    },
    actions: {
      copyHighlightedText: "Copiar texto resaltado",
      deleteHighlight: "Eliminar resaltado",
      expandTranslation: "Expandir explicación",
      collapseTranslation: "Contraer explicación",
      speakWord: "Pronunciar {{word}}",
      deleteVocabularyItem: "Eliminar elemento de vocabulario",
      copyExplanation: "Copiar explicación",
      deleteExplanation: "Eliminar explicación",
      export: "Exportar",
      clearCache: "Borrar caché",
      exportJson: "Exportar JSON",
      exportMarkdown: "Exportar Markdown",
      importJson: "Importar JSON",
      saveSettings: "Guardar ajustes",
      restoreDefault: "Restaurar valor predeterminado"
    },
    confirmations: {
      deleteHighlight: "¿Eliminar este resaltado?",
      deleteVocabularyItem: "¿Eliminar este elemento de vocabulario?",
      deleteExplanation: "¿Eliminar este registro de búsqueda?",
      clearExplanations: "¿Borrar todos los registros de búsqueda?"
    },
    settings: {
      llm: "LLM",
      baseUrl: "Base URL",
      apiKey: "API Key",
      model: "Modelo",
      temperature: "Temperature",
      timeoutMs: "Tiempo de espera ms",
      promptTemplate: "Plantilla de prompt",
      promptTemplateHelp: "Variables disponibles: {{task}}, {{selection}}, {{context}}",
      behavior: "Comportamiento",
      autoCloseLookupPanelOnCopy: "Cerrar automáticamente el popup de búsqueda después de copiar",
      language: "Idioma",
      languageHelp: "El idioma seleccionado se usa para la interfaz y como idioma de destino de traducción del LLM.",
      pronunciation: "Pronunciación",
      merriamWebsterApiKey: "Merriam-Webster API Key",
      preferences: "Preferencias",
      enableExtensionGlobally: "Activar resaltado de páginas globalmente",
      defaultHighlightColor: "Color de resaltado predeterminado",
      disabledSites: "Sitios desactivados",
      disabledSitesHelp: "Un hostname por línea, por ejemplo: example.com",
      importExport: "Importar / Exportar",
      includeSensitiveConfig: "Incluir configuración sensible en la exportación JSON"
    },
    notices: {
      settingsSaved: "Ajustes guardados.",
      jsonImported: "JSON importado.",
      dataRefreshed: "Datos actualizados.",
      highlightDeleted: "Resaltado eliminado.",
      vocabularyDeleted: "Elemento de vocabulario eliminado.",
      copied: "Copiado.",
      jsonExported: "JSON exportado.",
      markdownExported: "Markdown exportado.",
      promptRestored: "Prompt predeterminado restaurado.",
      pronunciationStarted: "Pronunciación iniciada."
    },
    errors: {
      promptTemplateMissingVariables: "A la plantilla de prompt le faltan variables obligatorias: {{variables}}"
    },
    statusDescriptions: {
      active: "Este resaltado se restauró en la página fuente.",
      not_found: "No se encontró el ancla de texto guardada en la página fuente.",
      ambiguous: "El ancla de texto guardada coincidió con varios lugares en la página fuente.",
      pending: "Este resaltado aún no se ha confirmado en una página fuente."
    },
    export: {
      explanationsTitle: "Registros de búsqueda",
      exported: "Exportado",
      source: "Fuente",
      model: "Modelo",
      untitled: "Sin título"
    }
  }
};
