"use client";
import {createContext,useContext,type ReactNode} from 'react';
import {normalizeLanguage,translate,type Language} from '@/lib/language';
const Context=createContext<Language>('en');
export function LanguageProvider({language,children}:{language:Language;children:ReactNode}){return <Context.Provider value={language}>{children}</Context.Provider>;}
export function useLanguage(){const language=useContext(Context);return {language,t:(text:string)=>translate(normalizeLanguage(language),text)};}
